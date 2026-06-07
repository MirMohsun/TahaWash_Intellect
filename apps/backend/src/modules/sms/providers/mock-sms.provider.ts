import { Injectable, Logger } from '@nestjs/common';
import type { SmsProvider } from '../sms.types';

/**
 * Mock SMS provider — logs OTP codes to the server console.
 *
 * Use ONLY in development. Lets us iterate on the auth flow without paying
 * real SMS costs. The code printed in the server log is what the user would
 * have received via SMS.
 */
@Injectable()
export class MockSmsProvider implements SmsProvider {
  private readonly logger = new Logger(MockSmsProvider.name);

  async sendOtp(phone: string, code: string): Promise<void> {
    this.logger.log(
      `📱 [MOCK SMS] To ${phone}: Your Tahawash code is ${code} (expires in 5 minutes)`,
    );
  }
}
