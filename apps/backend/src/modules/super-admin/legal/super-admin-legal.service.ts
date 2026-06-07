import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { PublishLegalDocumentDto } from './dto/publish-legal-document.dto';
import {
  isLegalDocType,
  isLegalLanguage,
  LEGAL_DOC_TYPES,
  LEGAL_LANGUAGES,
  type LegalDocType,
  type LegalLanguage,
  type LegalSection,
} from './legal.constants';

/**
 * Versioned legal-doc management (C10.4).
 *
 * Schema invariant: at most one row per (type, language) has
 * isCurrent=true. Maintained app-side in $transaction calls — Prisma
 * doesn't model partial-unique indexes, and at single-super-admin MVP
 * scale a concurrent publish isn't a concern.
 *
 * Super-admin actors bypass Prisma scoping — no withBypass needed.
 */
@Injectable()
export class SuperAdminLegalService {
  private readonly logger = new Logger(SuperAdminLegalService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Current rows for every (type, language) combination. Missing slots
   * come back as `null` so the admin UI can show "Not yet published".
   */
  async getCurrentMap() {
    const rows = await this.prisma.scoped.legalDocument.findMany({
      where: { isCurrent: true },
    });

    const result: Record<
      LegalDocType,
      Record<LegalLanguage, ReturnType<typeof serialize> | null>
    > = {
      terms: { az: null, ru: null, en: null },
      privacy: { az: null, ru: null, en: null },
    };

    for (const row of rows) {
      if (isLegalDocType(row.type) && isLegalLanguage(row.language)) {
        result[row.type][row.language] = serialize(row);
      }
    }
    return result;
  }

  /**
   * Full version history for a single (type, language) — newest first.
   * The current row is included with isCurrent=true.
   */
  async listVersions(type: string, language: string) {
    if (!isLegalDocType(type)) {
      throw new BadRequestException({
        code: 'UNKNOWN_LEGAL_TYPE',
        message: `type must be one of: ${LEGAL_DOC_TYPES.join(', ')}`,
      });
    }
    if (!isLegalLanguage(language)) {
      throw new BadRequestException({
        code: 'UNKNOWN_LEGAL_LANGUAGE',
        message: `language must be one of: ${LEGAL_LANGUAGES.join(', ')}`,
      });
    }

    const rows = await this.prisma.scoped.legalDocument.findMany({
      where: { type, language },
      orderBy: { version: 'desc' },
    });
    return { items: rows.map(serialize) };
  }

  /**
   * Publish a new version of (type, language). Auto-bumps `version`
   * (max+1) and flips any previous-current row's `isCurrent=false` in
   * the same transaction. Writes an audit-log row.
   */
  async publish(
    type: string,
    language: string,
    dto: PublishLegalDocumentDto,
    superAdminUserId: string,
  ) {
    if (!isLegalDocType(type)) {
      throw new BadRequestException({
        code: 'UNKNOWN_LEGAL_TYPE',
        message: `type must be one of: ${LEGAL_DOC_TYPES.join(', ')}`,
      });
    }
    if (!isLegalLanguage(language)) {
      throw new BadRequestException({
        code: 'UNKNOWN_LEGAL_LANGUAGE',
        message: `language must be one of: ${LEGAL_LANGUAGES.join(', ')}`,
      });
    }

    const latest = await this.prisma.scoped.legalDocument.findFirst({
      where: { type, language },
      orderBy: { version: 'desc' },
      select: { version: true, id: true, isCurrent: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    const sections: LegalSection[] = dto.sections.map((s) => ({
      heading: s.heading.trim(),
      body: s.body.trim(),
    }));

    type Op =
      | Prisma.PrismaPromise<unknown>
      | ReturnType<typeof this.prisma.scoped.legalDocument.create>
      | ReturnType<typeof this.prisma.scoped.legalDocument.updateMany>
      | ReturnType<typeof this.prisma.scoped.auditLog.create>;

    const ops: Op[] = [
      // Clear the previous current row(s). updateMany covers the edge
      // case where the invariant somehow got violated and >1 row is
      // marked current.
      this.prisma.scoped.legalDocument.updateMany({
        where: { type, language, isCurrent: true },
        data: { isCurrent: false },
      }),
      // Create the new version as current.
      this.prisma.scoped.legalDocument.create({
        data: {
          type,
          language,
          version: nextVersion,
          sections: sections as unknown as Prisma.InputJsonValue,
          publishedBy: superAdminUserId,
          isCurrent: true,
        },
      }),
      this.prisma.scoped.auditLog.create({
        data: {
          actorType: 'super_admin',
          actorId: superAdminUserId,
          action: 'legal_document.publish',
          resourceType: 'legal_document',
          resourceId: null,
          changes: {
            type,
            language,
            version: nextVersion,
            sectionCount: sections.length,
          } as Prisma.InputJsonValue,
        },
      }),
    ];

    const results = await this.prisma.$transaction(ops as Prisma.PrismaPromise<unknown>[]);
    const created = results[1] as Awaited<
      ReturnType<typeof this.prisma.scoped.legalDocument.create>
    >;

    this.logger.log(
      `Legal document published: type=${type} language=${language} version=${nextVersion} sections=${sections.length}`,
    );

    return serialize(created);
  }

  /**
   * Roll back: set an older version as the current one. The current
   * row (if any) is flipped to isCurrent=false; the target row to
   * isCurrent=true. No new row is created — restoring is point-in-time
   * pointer-flip, version numbers don't reshuffle.
   */
  async makeCurrent(id: string, superAdminUserId: string) {
    const target = await this.prisma.scoped.legalDocument.findUnique({ where: { id } });
    if (!target) {
      throw new NotFoundException({
        code: 'LEGAL_DOCUMENT_NOT_FOUND',
        message: 'Legal document not found.',
      });
    }
    if (target.isCurrent) {
      // No-op — already current. Return the row unchanged.
      return serialize(target);
    }

    type Op =
      | Prisma.PrismaPromise<unknown>
      | ReturnType<typeof this.prisma.scoped.legalDocument.update>
      | ReturnType<typeof this.prisma.scoped.legalDocument.updateMany>
      | ReturnType<typeof this.prisma.scoped.auditLog.create>;

    const ops: Op[] = [
      this.prisma.scoped.legalDocument.updateMany({
        where: { type: target.type, language: target.language, isCurrent: true },
        data: { isCurrent: false },
      }),
      this.prisma.scoped.legalDocument.update({
        where: { id },
        data: { isCurrent: true },
      }),
      this.prisma.scoped.auditLog.create({
        data: {
          actorType: 'super_admin',
          actorId: superAdminUserId,
          action: 'legal_document.restore',
          resourceType: 'legal_document',
          resourceId: id,
          changes: {
            type: target.type,
            language: target.language,
            restoredVersion: target.version,
          } as Prisma.InputJsonValue,
        },
      }),
    ];

    const results = await this.prisma.$transaction(ops as Prisma.PrismaPromise<unknown>[]);
    const updated = results[1] as Awaited<
      ReturnType<typeof this.prisma.scoped.legalDocument.update>
    >;

    this.logger.log(
      `Legal document restored: id=${id} type=${target.type} language=${target.language} version=${target.version}`,
    );

    return serialize(updated);
  }
}

// ─── serializer ───────────────────────────────────────────────────

interface RawLegalDocumentRow {
  id: string;
  type: string;
  language: string;
  version: number;
  sections: Prisma.JsonValue;
  publishedAt: Date;
  publishedBy: string | null;
  isCurrent: boolean;
  createdAt: Date;
}

function serialize(row: RawLegalDocumentRow) {
  return {
    id: row.id,
    type: row.type,
    language: row.language,
    version: row.version,
    sections: coerceSections(row.sections),
    publishedAt: row.publishedAt.toISOString(),
    publishedBy: row.publishedBy,
    isCurrent: row.isCurrent,
    createdAt: row.createdAt.toISOString(),
  };
}

function coerceSections(json: Prisma.JsonValue): LegalSection[] {
  if (!Array.isArray(json)) return [];
  const out: LegalSection[] = [];
  for (const entry of json) {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const obj = entry as Record<string, unknown>;
      const heading = typeof obj.heading === 'string' ? obj.heading : '';
      const body = typeof obj.body === 'string' ? obj.body : '';
      out.push({ heading, body });
    }
  }
  return out;
}
