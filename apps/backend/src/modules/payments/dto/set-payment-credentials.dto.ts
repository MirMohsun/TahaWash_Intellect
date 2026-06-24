import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetPaymentCredentialsDto {
  /** ePoint public_key / merchant id, e.g. "i000000001". Public, not secret. */
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  merchantId!: string;

  /** ePoint private_key (secret). Stored AES-256-GCM-encrypted; never returned. */
  @IsString()
  @MinLength(8)
  @MaxLength(256)
  privateKey!: string;
}
