import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { randomInt } from 'node:crypto';
import { RequestContext } from '../../common/request-context';
import type { Env } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';

/**
 * QR code + printable PDF generation for wash bays.
 *
 * Short-ID format: 6 characters from base36 (digits + uppercase letters).
 * Excludes confusing characters (0, O, 1, I, L) to keep printed stickers
 * readable if someone needs to type the ID for support.
 *
 * Total namespace ≈ 31^6 = ~887 million IDs — plenty of room.
 */
const QR_SHORT_ID_LENGTH = 6;
const QR_SHORT_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 chars, no 0/1/O/I/L
const QR_SHORT_ID_MAX_ATTEMPTS = 10; // retry-on-collision (collisions are astronomically rare)

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Generate a unique qrShortId not already present in the bays table.
   *
   * Bypasses tenant scoping for the uniqueness check — the shortId namespace
   * is global across all tenants (it's what the QR sticker encodes).
   */
  async generateUniqueShortId(): Promise<string> {
    for (let attempt = 0; attempt < QR_SHORT_ID_MAX_ATTEMPTS; attempt++) {
      const candidate = makeShortId();
      const exists = await RequestContext.withBypass(() =>
        this.prisma.scoped.bay.findUnique({ where: { qrShortId: candidate } }),
      );
      if (!exists) return candidate;
      this.logger.warn(`qrShortId collision on attempt ${attempt + 1}: ${candidate}`);
    }
    throw new Error('Could not generate a unique qrShortId after retries.');
  }

  /**
   * Build the full QR target URL.
   *
   * Format locked to spec: `https://app.tahawash.az/d/{shortId}`. The
   * customer app handles this via Universal Links (iOS) + App Links
   * (Android) so scanning opens the in-app charge screen directly.
   */
  buildQrTargetUrl(qrShortId: string): string {
    const baseUrl = this.config.get('PUBLIC_APP_URL', { infer: true }) ?? 'https://app.tahawash.az';
    return `${baseUrl.replace(/\/+$/, '')}/d/${qrShortId}`;
  }

  /** PNG bytes of the QR code for a given short id. Used for in-admin previews. */
  async renderQrPng(qrShortId: string, size = 512): Promise<Buffer> {
    const url = this.buildQrTargetUrl(qrShortId);
    return QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H', // High — survives printing/lamination wear
      margin: 2,
      width: size,
      color: { dark: '#14181F', light: '#FFFFFF' },
    });
  }

  /**
   * Build a printable A4 PDF for a single bay's QR sticker.
   *
   * Layout (top to bottom, centered):
   *   - Tahawash wordmark
   *   - Bay name (large)
   *   - Location name + address (smaller)
   *   - The QR code itself (~12cm wide for easy scanning)
   *   - Short ID printed below (for support reference)
   *   - Footer: "Tahawash · Self-service carwash payments"
   */
  async renderBayQrPdf(opts: BayQrPageOpts): Promise<Buffer> {
    return this.buildPdf(
      {
        title: `Tahawash QR — ${opts.bayName}`,
        subject: `Bay ${opts.bayName} (${opts.qrShortId})`,
      },
      async (doc) => {
        await this.appendBayPage(doc, opts);
      },
    );
  }

  /**
   * Build a single PDF with one A4 page per bay. Used by the bulk-print
   * action in the admin's Bays section — saves the tenant from clicking
   * each row individually when setting up a new branch.
   *
   * Each page reuses the same layout as the single-bay method, with
   * `doc.addPage()` separating them. PDFKit handles the per-page state
   * reset automatically.
   */
  async renderBulkBayQrPdf(
    bays: BayQrPageOpts[],
    meta: { tenantBrandName: string; locationName: string },
  ): Promise<Buffer> {
    if (bays.length === 0) {
      throw new Error('renderBulkBayQrPdf called with empty bay list');
    }
    return this.buildPdf(
      {
        title: `Tahawash QR — ${meta.locationName}`,
        subject: `${bays.length} QR stickers for ${meta.tenantBrandName} · ${meta.locationName}`,
      },
      async (doc) => {
        for (let i = 0; i < bays.length; i++) {
          if (i > 0) doc.addPage();
          await this.appendBayPage(doc, bays[i]!);
        }
      },
    );
  }

  /**
   * PDF builder skeleton — owns the document lifecycle so the page
   * renderers can stay pure.
   */
  private buildPdf(
    info: { title: string; subject: string },
    write: (doc: PDFKit.PDFDocument) => Promise<void>,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: info.title,
          Author: 'Tahawash',
          Subject: info.subject,
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      write(doc)
        .then(() => doc.end())
        .catch(reject);
    });
  }

  /** Render one bay's QR onto the current page of `doc`. */
  private async appendBayPage(doc: PDFKit.PDFDocument, opts: BayQrPageOpts): Promise<void> {
    const targetUrl = this.buildQrTargetUrl(opts.qrShortId);
    const qrPngBuffer = await QRCode.toBuffer(targetUrl, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 1200,
      color: { dark: '#14181F', light: '#FFFFFF' },
    });

    const pageW = doc.page.width;
    const margin = 50;

    doc
      .fontSize(18)
      .fillColor('#2276D6')
      .font('Helvetica-Bold')
      .text('TAHAWASH', margin, margin, { align: 'center', width: pageW - margin * 2 });

    doc
      .fontSize(11)
      .fillColor('#6B7280')
      .font('Helvetica')
      .text(opts.tenantBrandName, { align: 'center' });

    doc.moveDown(2.5);

    doc
      .fontSize(40)
      .fillColor('#14181F')
      .font('Helvetica-Bold')
      .text(opts.bayName, { align: 'center' });

    doc.moveDown(0.4);

    doc
      .fontSize(13)
      .fillColor('#3A4250')
      .font('Helvetica')
      .text(opts.locationName, { align: 'center' });

    doc.moveDown(0.2);

    doc
      .fontSize(11)
      .fillColor('#6B7280')
      .text(opts.locationAddress, { align: 'center', width: pageW - margin * 2 });

    doc.moveDown(1.5);

    const qrSize = 340;
    const qrX = (pageW - qrSize) / 2;
    const qrY = doc.y;
    doc.image(qrPngBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    doc.y = qrY + qrSize + 18;

    doc
      .fontSize(20)
      .fillColor('#14181F')
      .font('Helvetica-Bold')
      .text(opts.qrShortId, { align: 'center' });

    doc.moveDown(0.2);

    doc
      .fontSize(11)
      .fillColor('#6B7280')
      .font('Helvetica')
      .text('Scan with your phone to start a wash', { align: 'center' });

    const footerY = doc.page.height - margin - 18;
    doc
      .fontSize(9)
      .fillColor('#9AA1AB')
      .font('Helvetica')
      .text('Tahawash · Self-service carwash payments · tahawash.az', margin, footerY, {
        align: 'center',
        width: pageW - margin * 2,
      });
  }
}

interface BayQrPageOpts {
  qrShortId: string;
  bayName: string;
  locationName: string;
  locationAddress: string;
  tenantBrandName: string;
}

// ─── helpers ───────────────────────────────────────────────────

function makeShortId(): string {
  const len = QR_SHORT_ID_ALPHABET.length;
  let out = '';
  for (let i = 0; i < QR_SHORT_ID_LENGTH; i++) {
    out += QR_SHORT_ID_ALPHABET.charAt(randomInt(0, len));
  }
  return out;
}
