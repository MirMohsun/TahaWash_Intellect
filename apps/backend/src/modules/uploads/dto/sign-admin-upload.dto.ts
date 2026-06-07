import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from './sign-upload.dto';

/**
 * Body of `POST /super-admin/uploads/sign`. Platform-level uploads that
 * aren't owned by any tenant — currently promo banner images. Same file
 * shape rules as the tenant sign endpoint; only the key namespace and the
 * auth guard differ.
 */
export class SignAdminUploadDto {
  @ApiProperty({
    enum: ['promo_image'],
    description: 'What this upload becomes. promo_image → stored under promos/ and pasted into Promo.imageUrl.',
  })
  @IsIn(['promo_image'])
  kind!: 'promo_image';

  @ApiProperty({ enum: ALLOWED_UPLOAD_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn([...ALLOWED_UPLOAD_CONTENT_TYPES])
  contentType!: (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

  @ApiProperty({ example: 123456, description: `Max ${MAX_UPLOAD_BYTES} bytes (~8 MB).` })
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_BYTES)
  sizeBytes!: number;

  @ApiProperty({ example: 'summer-promo.jpg', required: false })
  @IsOptional()
  @Matches(/^[\w.\-]{1,128}$/, { message: 'filename must be 1-128 ascii word chars' })
  filename?: string;
}
