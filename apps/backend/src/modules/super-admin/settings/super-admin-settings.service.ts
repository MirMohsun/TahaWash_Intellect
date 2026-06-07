import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdatePlatformSettingsDto } from './dto/update-settings.dto';
import { isPlatformSettingKey } from './settings.constants';

/**
 * Platform settings (C10.1 + C10.2) — Tahawash branding + support config.
 *
 * Backing model PlatformSetting is a key-value table. GET returns the
 * full map (with empty strings for keys the admin hasn't set yet).
 * PATCH accepts a diff-only items array and writes only the changed
 * keys. An empty `value` deletes the row.
 *
 * Super-admin actors bypass Prisma scoping; queries here see all rows.
 */
@Injectable()
export class SuperAdminSettingsService {
  private readonly logger = new Logger(SuperAdminSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.scoped.platformSetting.findMany();
    const out: Record<string, string> = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  }

  async update(dto: UpdatePlatformSettingsDto): Promise<Record<string, string>> {
    // Reject unknown keys up front so the admin gets a single error,
    // not partial writes.
    const invalid = dto.items.filter((i) => !isPlatformSettingKey(i.key));
    if (invalid.length > 0) {
      throw new BadRequestException({
        code: 'UNKNOWN_SETTING_KEY',
        message: `Unknown platform setting key(s): ${invalid.map((i) => i.key).join(', ')}`,
      });
    }

    // Empty string → delete row. Non-empty → upsert.
    const ops: Array<Promise<unknown>> = [];
    for (const item of dto.items) {
      if (item.value.trim() === '') {
        ops.push(
          this.prisma.scoped.platformSetting
            .delete({ where: { key: item.key } })
            .catch((err: unknown) => {
              // Tolerate "row didn't exist" — clearing an unset key is a no-op.
              if ((err as { code?: string }).code === 'P2025') return;
              throw err;
            }),
        );
      } else {
        ops.push(
          this.prisma.scoped.platformSetting.upsert({
            where: { key: item.key },
            create: { key: item.key, value: item.value },
            update: { value: item.value },
          }),
        );
      }
    }
    await Promise.all(ops);

    this.logger.log(`Platform settings updated: ${dto.items.map((i) => i.key).join(', ')}`);
    return this.getAll();
  }
}
