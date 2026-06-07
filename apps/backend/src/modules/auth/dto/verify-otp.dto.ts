import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const AZ_PHONE_REGEX = /^\+994\d{9}$/;
const SIX_DIGIT_CODE = /^\d{6}$/;

export class VerifyOtpDto {
  @ApiProperty({ example: '+994501234567' })
  @IsString()
  @Matches(AZ_PHONE_REGEX, {
    message: 'phone must be in international AZ format +994XXXXXXXXX',
  })
  phone!: string;

  @ApiProperty({ example: '482917', description: '6-digit OTP code from SMS' })
  @IsString()
  @Matches(SIX_DIGIT_CODE, { message: 'code must be 6 digits' })
  code!: string;
}
