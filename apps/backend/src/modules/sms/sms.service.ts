import { Inject, Injectable } from '@nestjs/common';
import { SMS_PROVIDER_TOKEN, type SmsProvider } from './sms.types';

/**
 * Thin facade over whichever SmsProvider is wired (mock / Albatros / etc.).
 *
 * Callers (e.g. AuthService) inject this rather than a specific provider so
 * the implementation can swap based on env without touching business logic.
 */
@Injectable()
export class SmsService {
  constructor(@Inject(SMS_PROVIDER_TOKEN) private readonly provider: SmsProvider) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    return this.provider.sendOtp(phone, code);
  }
}
