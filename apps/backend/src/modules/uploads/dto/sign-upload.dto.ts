import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/**
 * Allowed image types — keep tight so a stray .svg/.gif doesn't end up
 * stored. WebP is included because it's a sensible modern format and
 * R2 hands it back unmodified.
 */
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Body of `POST /tenant/me/uploads/sign`. The server validates the file
 * shape claims and returns a one-time PUT URL for direct browser upload
 * to R2. We deliberately don't trust the client's claimed sizeBytes for
 * billing or security — R2 enforces with the signed Content-Length
 * header at upload time.
 */
export class SignUploadDto {
  @ApiProperty({
    enum: ['logo', 'photo'],
    description:
      'What this upload becomes once stored. logo updates tenant.logoUrl directly; photo is added to the gallery via POST /tenant/me/photos in a follow-up call.',
  })
  @IsIn(['logo', 'photo'])
  kind!: 'logo' | 'photo';

  @ApiProperty({ enum: ALLOWED_CONTENT_TYPES, example: 'image/jpeg' })
  @IsIn([...ALLOWED_CONTENT_TYPES])
  contentType!: (typeof ALLOWED_CONTENT_TYPES)[number];

  @ApiProperty({ example: 123456, description: `Max ${MAX_BYTES} bytes (~8 MB).` })
  @IsInt()
  @Min(1)
  @Max(MAX_BYTES)
  sizeBytes!: number;

  @ApiProperty({
    example: 'hero-1.jpg',
    description: 'Original filename — used only to derive the file extension; the storage key is server-generated.',
    required: false,
  })
  @IsOptional()
  @Matches(/^[\w.\-]{1,128}$/, { message: 'filename must be 1-128 ascii word chars' })
  filename?: string;
}

export const ALLOWED_UPLOAD_CONTENT_TYPES = ALLOWED_CONTENT_TYPES;
export const MAX_UPLOAD_BYTES = MAX_BYTES;
