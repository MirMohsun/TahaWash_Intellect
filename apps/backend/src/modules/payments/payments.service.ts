import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RequestContext } from '../../common/request-context';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { CredentialCipherService } from './crypto/credential-cipher.service';
import type { CreatePaymentDto, PaymentMethodChoice } from './dto/create-payment.dto';
import { decodeData, verifySignature } from './epoint/epoint-signature.util';
import {
  PAYMENT_PROVIDER_TOKEN,
  type EpointLanguage,
  type MerchantCredentials,
  type PaymentProvider,
  type PaymentProviderResult,
} from './payment.types';

/** What the mobile app receives from POST /payments. */
export interface CreatePaymentResult {
  /** Our transaction id (poll GET /payments/:id with this). */
  transactionId: string;
  /**
   * - `authorized` : charged immediately (saved card) — now crediting.
   * - `redirect`   : open `redirectUrl` (new card) or `widgetUrl` (Apple/Google Pay) in a WebView.
   * - `declined`   : the bank/gateway refused.
   */
  status: 'authorized' | 'redirect' | 'declined';
  redirectUrl?: string;
  widgetUrl?: string;
  message?: string;
}

/** Sanity ceiling so a fat-fingered amount can't create a huge charge. */
const MAX_CHARGE_CENTS = 100_000; // 1000.00 AZN

/**
 * Orchestrates customer payments through the active PaymentProvider.
 *
 * Flow: resolve the scanned bay → its tenant → that tenant's (decrypted) ePoint
 * credentials → validate the amount against the tenant's min/step → create a
 * `pending` Transaction (our id is the ePoint `order_id`) → call the provider:
 *   - saved card  → server-to-server charge → `paid_crediting` (or `declined`)
 *   - new card    → hosted page → return `redirectUrl` (stays `pending` until callback)
 *   - apple/google → token widget → return `widgetUrl`
 *
 * Security notes:
 *   - Bay/Location are tenant-scoped → read via withBypass (customer can't).
 *   - SavedCard is read in the CUSTOMER's scope, so a customer can only ever
 *     name their OWN card; we also assert the card belongs to the bay's tenant.
 *   - The tenant private_key is decrypted just-in-time and never returned/logged.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providerMode: 'mock' | 'epoint';
  private readonly appUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly cipher: CredentialCipherService,
    @Inject(PAYMENT_PROVIDER_TOKEN) private readonly provider: PaymentProvider,
  ) {
    this.providerMode = this.config.get('PAYMENT_PROVIDER', { infer: true });
    this.appUrl = this.config.get('PUBLIC_APP_URL', { infer: true });
  }

  async createPayment(customerId: string, dto: CreatePaymentDto): Promise<CreatePaymentResult> {
    // 1. Resolve the scanned bay + its location + tenant (tenant-scoped → bypass).
    const bay = await RequestContext.withBypass(() =>
      this.prisma.scoped.bay.findUnique({
        where: { qrShortId: dto.qrShortId },
        include: { location: true, tenant: true },
      }),
    );
    if (!bay || bay.tenant.deletedAt || bay.location.deletedAt) {
      throw new NotFoundException({ code: 'UNKNOWN_DEVICE' });
    }
    if (bay.status !== 'active') {
      throw new ForbiddenException({ code: 'DEVICE_DISABLED' });
    }
    if (bay.location.status !== 'active') {
      throw new ForbiddenException({ code: 'LOCATION_DISABLED' });
    }
    if (bay.tenant.status !== 'active') {
      throw new ForbiddenException({ code: 'TENANT_UNAVAILABLE' });
    }
    const tenant = bay.tenant;

    // 2. Validate the amount against the tenant's min charge + step.
    const amount = this.validateAmount(dto.amount, tenant);

    // 3. Resolve the tenant's merchant credentials (decrypt just-in-time).
    const creds = this.resolveCredentials(tenant);

    // 4. For a saved card: load it IN THE CUSTOMER'S SCOPE (ownership enforced)
    //    and assert it belongs to this carwash's merchant (tokens are per-merchant).
    let savedCard: { ePointToken: string; brand: string; lastFour: string } | null = null;
    if (dto.method === 'saved_card') {
      if (!dto.cardId) throw new BadRequestException({ code: 'CARD_ID_REQUIRED' });
      const card = await this.prisma.scoped.savedCard.findUnique({ where: { id: dto.cardId } });
      if (!card) throw new NotFoundException({ code: 'CARD_NOT_FOUND' });
      if (card.tenantId !== tenant.id) {
        throw new BadRequestException({ code: 'CARD_WRONG_MERCHANT' });
      }
      savedCard = { ePointToken: card.ePointToken, brand: card.brand, lastFour: card.lastFour };
    }

    // 5. Create the pending transaction (create is NOT auto-scoped → set ids explicitly).
    const txn = await this.prisma.scoped.transaction.create({
      data: {
        customerId,
        bayId: bay.id,
        locationId: bay.locationId,
        tenantId: tenant.id,
        amountAzn: amount,
        status: 'pending',
        paymentMethod: PAYMENT_METHOD[dto.method],
        ...(savedCard
          ? { cardBrand: savedCard.brand as never, cardLastFour: savedCard.lastFour }
          : {}),
      },
      select: { id: true },
    });

    const description = `Tahawash — ${tenant.brandName} — ${bay.name}`;
    const language = (dto.language ?? 'az') as EpointLanguage;

    // 6. Dispatch to the provider and map the outcome onto the transaction.
    try {
      if (dto.method === 'saved_card' && savedCard) {
        const result = await this.provider.chargeSavedCard(creds, {
          cardId: savedCard.ePointToken,
          orderId: txn.id,
          amount,
          description,
          language,
        });
        return this.finalizeServerCharge(txn.id, result);
      }

      if (dto.method === 'apple_pay' || dto.method === 'google_pay') {
        const result = await this.provider.createWidget(creds, {
          orderId: txn.id,
          amount,
          description,
        });
        return this.finalizeRedirect(txn.id, result);
      }

      // new_card (optionally saving the card)
      const redirectUrls = {
        successRedirectUrl: this.returnUrl(txn.id, 'success'),
        errorRedirectUrl: this.returnUrl(txn.id, 'error'),
      };
      const result = dto.saveCard
        ? await this.provider.createPaymentWithCardSave(creds, {
            orderId: txn.id,
            amount,
            description,
            language,
            ...redirectUrls,
          })
        : await this.provider.createPayment(creds, {
            orderId: txn.id,
            amount,
            description,
            language,
            ...redirectUrls,
          });
      return this.finalizeRedirect(txn.id, result);
    } catch (err) {
      // Transport/gateway failure (provider threw). Leave the txn `pending` so a
      // late callback can still resolve it, record the reason, and rethrow.
      const reason = err instanceof Error ? err.message : String(err);
      await this.safeUpdate(txn.id, { errorReason: reason.slice(0, 500) });
      this.logger.error(`Payment ${txn.id} provider error: ${reason}`);
      throw err;
    }
  }

  /** Status poll for the mobile app after a redirect/widget flow. */
  async getTransactionStatus(_customerId: string, transactionId: string) {
    const txn = await this.prisma.scoped.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, status: true, amountAzn: true, ePointReference: true, errorReason: true },
    });
    if (!txn) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    return {
      transactionId: txn.id,
      status: txn.status,
      amountAzn: txn.amountAzn.toString(),
      ePointReference: txn.ePointReference,
      errorReason: txn.errorReason,
    };
  }

  /**
   * [MOCK ONLY] Simulate ePoint completing a redirect/widget payment, so the
   * full new-card / Apple-Pay flow is demoable before the real webhook lands
   * (Increment 5). Refuses to run when a real provider is active.
   */
  async mockComplete(_customerId: string, transactionId: string): Promise<{ status: string }> {
    if (this.providerMode !== 'mock') {
      throw new ForbiddenException({ code: 'MOCK_ONLY' });
    }
    const txn = await this.prisma.scoped.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true, status: true },
    });
    if (!txn) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    if (txn.status !== 'pending') return { status: txn.status }; // idempotent
    await this.prisma.scoped.transaction.update({
      where: { id: transactionId },
      data: { status: 'paid_crediting' },
    });
    return { status: 'paid_crediting' };
  }

  /**
   * Finalize a payment from ePoint's signed server-to-server callback.
   *
   * Routed per-merchant as POST /webhooks/epoint/:tenantId so we know which
   * tenant's private_key to verify with. Steps:
   *   1. Verify the signature with that tenant's key (reject 400 if forged).
   *   2. Look up the transaction by order_id; confirm it's this tenant's + pending.
   *   3. success → paid_crediting (+ save the card token if one was registered);
   *      failure → declined.
   *
   * Idempotent (a repeat callback on a finalized txn is a no-op) and runs in
   * `withBypass` (no customer/tenant session on a webhook).
   */
  async handleEpointCallback(tenantId: string, data: string, signature: string): Promise<void> {
    if (!data || !signature) {
      throw new BadRequestException({ code: 'MISSING_CALLBACK_FIELDS' });
    }

    const tenant = await RequestContext.withBypass(() =>
      this.prisma.scoped.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, ePointPrivateKeyEnc: true },
      }),
    );
    if (!tenant) throw new NotFoundException({ code: 'UNKNOWN_MERCHANT' });

    if (!verifySignature(data, signature, this.tenantPrivateKey(tenant))) {
      this.logger.warn(`ePoint callback for tenant ${tenantId}: INVALID SIGNATURE — rejected.`);
      throw new BadRequestException({ code: 'INVALID_SIGNATURE' });
    }

    const payload = decodeData(data);
    const orderId = asString(payload.order_id);
    const status = asString(payload.status);
    if (!orderId) throw new BadRequestException({ code: 'MISSING_ORDER_ID' });

    await RequestContext.withBypass(async () => {
      const txn = await this.prisma.scoped.transaction.findUnique({
        where: { id: orderId },
        select: { id: true, status: true, tenantId: true, customerId: true, amountAzn: true },
      });
      if (!txn) {
        this.logger.warn(`ePoint callback: unknown order_id ${orderId} (tenant ${tenantId}).`);
        return; // 200 — nothing to finalize; don't trigger retries
      }
      if (txn.tenantId !== tenantId) {
        this.logger.warn(`ePoint callback: order ${orderId} is not tenant ${tenantId}'s — ignored.`);
        return;
      }
      if (txn.status !== 'pending') {
        this.logger.log(`ePoint callback: order ${orderId} already ${txn.status} — idempotent skip.`);
        return;
      }

      const cbAmount = asString(payload.amount);
      if (cbAmount && toCents(cbAmount) !== toCents(txn.amountAzn.toString())) {
        this.logger.warn(
          `ePoint callback amount ${cbAmount} != txn amount ${txn.amountAzn.toString()} for ${orderId}.`,
        );
      }

      if (status === 'success') {
        await this.prisma.scoped.transaction.update({
          where: { id: orderId },
          data: {
            status: 'paid_crediting',
            ePointReference: asString(payload.transaction) ?? null,
            cardLastFour: maskToLast4(asString(payload.card_mask)),
          },
        });
        const cardId = asString(payload.card_id);
        if (cardId && txn.customerId) {
          await this.saveCardFromCallback(txn.customerId, tenantId, cardId, payload);
        }
        // NEXT (Phase 5 — hardware): enqueue the bay-credit command here.
        this.logger.log(`ePoint callback: order ${orderId} paid → crediting.`);
      } else {
        await this.prisma.scoped.transaction.update({
          where: { id: orderId },
          data: { status: 'declined', errorReason: asString(payload.message) ?? 'Payment failed' },
        });
        this.logger.log(`ePoint callback: order ${orderId} declined.`);
      }
    });
  }

  // ── tenant credential management (tenant-admin) ──────────────────

  /** Whether a tenant has ePoint credentials set. NEVER returns the secret. */
  async getCredentialStatus(
    tenantId: string,
  ): Promise<{ configured: boolean; merchantId: string | null }> {
    const t = await this.prisma.scoped.tenant.findUnique({
      where: { id: tenantId },
      select: { ePointMerchantId: true, ePointPrivateKeyEnc: true },
    });
    if (!t) throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    return {
      configured: Boolean(t.ePointMerchantId && t.ePointPrivateKeyEnc),
      merchantId: t.ePointMerchantId,
    };
  }

  /** Store a tenant's ePoint credentials — the private key is encrypted at rest. */
  async setCredentials(
    tenantId: string,
    merchantId: string,
    privateKey: string,
  ): Promise<{ configured: boolean; merchantId: string }> {
    if (!this.cipher.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_ENCRYPTION_KEY_MISSING',
        message: 'Server payment encryption is not configured; cannot store credentials.',
      });
    }
    const merchant = merchantId.trim();
    await this.prisma.scoped.tenant.update({
      where: { id: tenantId },
      data: {
        ePointMerchantId: merchant,
        ePointPrivateKeyEnc: this.cipher.encrypt(privateKey.trim()),
      },
    });
    this.logger.log(`ePoint credentials updated for tenant ${tenantId} (merchant ${merchant}).`);
    return { configured: true, merchantId: merchant };
  }

  /** Remove a tenant's ePoint credentials. */
  async clearCredentials(tenantId: string): Promise<{ configured: boolean; merchantId: null }> {
    await this.prisma.scoped.tenant.update({
      where: { id: tenantId },
      data: { ePointMerchantId: null, ePointPrivateKeyEnc: null },
    });
    this.logger.log(`ePoint credentials cleared for tenant ${tenantId}.`);
    return { configured: false, merchantId: null };
  }

  // ── internals ───────────────────────────────────────────────────

  private async finalizeServerCharge(
    transactionId: string,
    result: PaymentProviderResult,
  ): Promise<CreatePaymentResult> {
    if (result.ok) {
      await this.prisma.scoped.transaction.update({
        where: { id: transactionId },
        data: { status: 'paid_crediting', ePointReference: result.transactionId ?? null },
      });
      // NEXT (Phase 5 — hardware): enqueue the bay-credit command here; the
      // hardware ACK moves the txn paid_crediting → paid_credited.
      this.logger.log(`Payment ${transactionId} authorized (saved card) → crediting.`);
      return { transactionId, status: 'authorized', message: 'Payment approved' };
    }
    await this.prisma.scoped.transaction.update({
      where: { id: transactionId },
      data: { status: 'declined', errorReason: result.message ?? 'Card declined' },
    });
    return { transactionId, status: 'declined', message: result.message ?? 'Card declined' };
  }

  private async finalizeRedirect(
    transactionId: string,
    result: PaymentProviderResult,
  ): Promise<CreatePaymentResult> {
    const url = result.redirectUrl ?? result.widgetUrl;
    if (!result.ok || !url) {
      await this.prisma.scoped.transaction.update({
        where: { id: transactionId },
        data: { status: 'declined', errorReason: result.message ?? 'Could not start payment' },
      });
      return { transactionId, status: 'declined', message: result.message };
    }
    // Record the gateway transaction ref (if any) but stay `pending` until the
    // callback/poll confirms the customer actually paid.
    if (result.transactionId) {
      await this.safeUpdate(transactionId, { ePointReference: result.transactionId });
    }
    return {
      transactionId,
      status: 'redirect',
      redirectUrl: result.redirectUrl,
      widgetUrl: result.widgetUrl,
    };
  }

  private resolveCredentials(tenant: {
    brandName: string;
    ePointMerchantId: string | null;
    ePointPrivateKeyEnc: string | null;
  }): MerchantCredentials {
    if (this.providerMode === 'mock') {
      return { publicKey: tenant.ePointMerchantId ?? 'i000000mock', privateKey: 'mock-private-key' };
    }
    if (!tenant.ePointMerchantId || !tenant.ePointPrivateKeyEnc) {
      throw new BadRequestException({
        code: 'TENANT_PAYMENT_NOT_CONFIGURED',
        message: `${tenant.brandName} hasn't finished payment setup yet.`,
      });
    }
    return {
      publicKey: tenant.ePointMerchantId,
      privateKey: this.cipher.decrypt(tenant.ePointPrivateKeyEnc),
    };
  }

  /** The tenant's ePoint private_key, for callback signature verification. */
  private tenantPrivateKey(tenant: { ePointPrivateKeyEnc: string | null }): string {
    if (this.providerMode === 'mock') return 'mock-private-key';
    if (!tenant.ePointPrivateKeyEnc) {
      throw new BadRequestException({ code: 'TENANT_PAYMENT_NOT_CONFIGURED' });
    }
    return this.cipher.decrypt(tenant.ePointPrivateKeyEnc);
  }

  /** Persist a card token returned by a save-card flow (idempotent by token). */
  private async saveCardFromCallback(
    customerId: string,
    tenantId: string,
    cardId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const mask = asString(payload.card_mask) ?? '';
    await this.prisma.scoped.savedCard.upsert({
      where: { ePointToken: cardId },
      update: {},
      create: {
        customerId,
        tenantId,
        ePointToken: cardId,
        lastFour: maskToLast4(mask) ?? '0000',
        brand: guessCardBrand(mask) as never,
      },
    });
    this.logger.log(`Saved card token for customer ${customerId} @ tenant ${tenantId}.`);
  }

  /** Validate against the tenant's min/step and return a normalized "0.00" string. */
  private validateAmount(
    raw: string,
    tenant: { minChargeAmount: unknown; chargeStep: unknown },
  ): string {
    const cents = Math.round(Number(raw) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      throw new BadRequestException({ code: 'INVALID_AMOUNT' });
    }
    const minCents = Math.round(Number(String(tenant.minChargeAmount)) * 100);
    const stepCents = Math.round(Number(String(tenant.chargeStep)) * 100);
    if (cents < minCents) {
      throw new BadRequestException({
        code: 'AMOUNT_BELOW_MIN',
        message: `Minimum charge is ${(minCents / 100).toFixed(2)} AZN.`,
      });
    }
    if (stepCents > 0 && (cents - minCents) % stepCents !== 0) {
      throw new BadRequestException({
        code: 'AMOUNT_NOT_ALIGNED',
        message: `Amount must be in steps of ${(stepCents / 100).toFixed(2)} AZN.`,
      });
    }
    if (cents > MAX_CHARGE_CENTS) {
      throw new BadRequestException({ code: 'AMOUNT_TOO_LARGE' });
    }
    return (cents / 100).toFixed(2);
  }

  private returnUrl(transactionId: string, status: 'success' | 'error'): string {
    return `${this.appUrl}/pay-return?tx=${encodeURIComponent(transactionId)}&status=${status}`;
  }

  /** Best-effort update that won't mask the original error if it fails. */
  private async safeUpdate(
    transactionId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.scoped.transaction.update({ where: { id: transactionId }, data });
    } catch (err) {
      this.logger.warn(
        `Could not update txn ${transactionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** Map the customer's method choice to the stored PaymentMethod enum. */
const PAYMENT_METHOD: Record<PaymentMethodChoice, 'card' | 'apple_pay' | 'google_pay'> = {
  saved_card: 'card',
  new_card: 'card',
  apple_pay: 'apple_pay',
  google_pay: 'google_pay',
};

/** Coerce an unknown JSON value to a non-empty string, else undefined. */
function asString(v: unknown): string | undefined {
  if (typeof v === 'string') return v.length > 0 ? v : undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function toCents(s: string): number {
  return Math.round(Number(s) * 100);
}

/** Last 4 digits from a masked PAN like "411111******1111". */
function maskToLast4(mask?: string): string | undefined {
  if (!mask) return undefined;
  const digits = mask.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : undefined;
}

/** Best-effort card brand from the masked PAN's leading digits. */
function guessCardBrand(mask: string): 'visa' | 'mastercard' | 'unionpay' | 'maestro' | 'unknown' {
  const d = mask.replace(/\D/g, '');
  if (d.startsWith('4')) return 'visa';
  if (d.startsWith('2') || d.startsWith('5')) return 'mastercard';
  if (d.startsWith('62') || d.startsWith('60')) return 'unionpay';
  if (d.startsWith('6')) return 'maestro';
  return 'unknown';
}
