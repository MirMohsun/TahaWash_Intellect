import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, EmailSendInput } from '../email.types';

/**
 * Mock email provider — logs the would-be email to the server console.
 *
 * Use ONLY in development. Lets us iterate on flows that depend on email
 * (password reset, subscription notices, suspend/activate) without a
 * Resend account or real domain verification. When Resend is wired,
 * replace the factory's `mock` branch with `resend` and templates render
 * server-side via Resend's API.
 *
 * The log format intentionally shows the full variables payload so a
 * developer can copy a reset link straight out of the terminal during
 * end-to-end testing.
 */
@Injectable()
export class MockEmailProvider implements EmailProvider {
  private readonly logger = new Logger(MockEmailProvider.name);

  async sendTemplated(input: EmailSendInput): Promise<void> {
    const vars = Object.entries(input.variables)
      .map(([k, v]) => `      ${k}: ${v}`)
      .join('\n');
    this.logger.log(
      `📧 [MOCK EMAIL] template=${input.template} locale=${input.locale} to=${input.to}\n${vars}`,
    );
  }
}
