import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/**
 * Azerbaijani mobile number in international format.
 * Accepts `+994` followed by exactly 9 digits (no spaces/dashes).
 * The mobile client strips formatting before sending.
 */
const AZ_PHONE_REGEX = /^\+994\d{9}$/;

export class RequestOtpDto {
  @ApiProperty({
    example: '+994501234567',
    description: 'Azerbaijani phone number, format +994XXXXXXXXX',
  })
  @IsString()
  @Matches(AZ_PHONE_REGEX, {
    message: 'phone must be in international AZ format +994XXXXXXXXX',
  })
  phone!: string;
}
