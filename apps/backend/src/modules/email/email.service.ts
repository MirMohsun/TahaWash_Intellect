import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER_TOKEN, type EmailProvider, type EmailSendInput } from './email.types';

/**
 * Thin facade over whichever EmailProvider is wired (mock / Resend / etc.).
 *
 * Business services (e.g. TenantAuthService.requestPasswordReset) inject
 * this so the impl can swap based on env without touching business logic.
 * Same pattern as SmsService.
 */
@Injectable()
export class EmailService {
  constructor(@Inject(EMAIL_PROVIDER_TOKEN) private readonly provider: EmailProvider) {}

  async sendTemplated(input: EmailSendInput): Promise<void> {
    return this.provider.sendTemplated(input);
  }
}
