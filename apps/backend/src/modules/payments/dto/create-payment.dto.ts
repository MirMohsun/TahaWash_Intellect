import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

/** How the customer chose to pay. */
export type PaymentMethodChoice = 'saved_card' | 'new_card' | 'apple_pay' | 'google_pay';

export class CreatePaymentDto {
  /** The scanned bay's QR short id. */
  @IsString()
  @MaxLength(16)
  qrShortId!: string;

  /** Amount in AZN as a positive 2-decimal string, e.g. "2.50". */
  @IsString()
  @Matches(/^\d{1,5}(\.\d{1,2})?$/, {
    message: 'amount must be a positive number with up to 2 decimals',
  })
  amount!: string;

  /**
   * saved_card  → server-to-server charge of a stored card (instant, no UI)
   * new_card    → hosted ePoint page (returns a redirectUrl to open in a WebView)
   * apple_pay / google_pay → ePoint token widget (returns a widgetUrl)
   */
  @IsIn(['saved_card', 'new_card', 'apple_pay', 'google_pay'])
  method!: PaymentMethodChoice;

  /** Our SavedCard id — REQUIRED when method = saved_card. */
  @IsOptional()
  @IsString()
  cardId?: string;

  /** For method = new_card: also save the card for future one-tap payments. */
  @IsOptional()
  @IsBoolean()
  saveCard?: boolean;

  /** Hosted-page language. Defaults to az. */
  @IsOptional()
  @IsIn(['az', 'en', 'ru'])
  language?: 'az' | 'en' | 'ru';
}
