/**
 * Email provider abstraction.
 *
 * Mirrors the SMS + Push modules. Concrete providers (mock for dev, Resend
 * for production) implement this interface; services inject EmailService
 * rather than a specific provider so the impl can swap based on env.
 *
 * MVP scope: a single sendTemplated() entry point keyed by template id.
 * Real templates live in `email/templates/` once the Resend provider lands;
 * the mock provider just logs the payload so we can see what would have
 * been sent.
 */
export type EmailTemplateId =
  | 'tenant-password-reset'
  | 'tenant-subscription-expiring'
  | 'tenant-subscription-expired'
  | 'tenant-suspended'
  | 'tenant-activated';

export type EmailLocale = 'az' | 'ru' | 'en';

export interface EmailSendInput {
  to: string;
  template: EmailTemplateId;
  locale: EmailLocale;
  /** Per-template substitution variables. Mock provider logs them verbatim. */
  variables: Record<string, string>;
}

export interface EmailProvider {
  sendTemplated(input: EmailSendInput): Promise<void>;
}

export const EMAIL_PROVIDER_TOKEN = Symbol('EMAIL_PROVIDER');
