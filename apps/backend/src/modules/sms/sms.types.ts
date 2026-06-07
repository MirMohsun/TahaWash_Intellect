/**
 * SMS provider abstraction.
 *
 * Concrete providers (mock for dev, AZ providers like Albatros / Lifecell for
 * production) implement this interface. AuthService never talks to a provider
 * directly — it calls SmsService which routes to the configured implementation.
 */
export interface SmsProvider {
  /** Send the OTP code to the given phone. Throws if delivery fails. */
  sendOtp(phone: string, code: string): Promise<void>;
}

/**
 * DI token used to inject the active SMS provider.
 * Multi-provider routing is done in the SmsModule factory.
 */
export const SMS_PROVIDER_TOKEN = Symbol('SMS_PROVIDER');
