import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateTenantSelfDto } from './dto/update-tenant-self.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tenant self-view. Multi-tenancy extension restricts the Tenant table to
   * `id = actor.tenantId`, so a tenant only ever sees their own row.
   */
  async getMe(tenantId: string) {
    const tenant = await this.prisma.scoped.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException({ code: 'TENANT_NOT_FOUND' });
    }
    return serializeTenant(tenant);
  }

  /**
   * Tenant updates their own profile. Fields not in UpdateTenantSelfDto cannot
   * be touched here (see the DTO's exclusion list comment).
   */
  async updateMe(tenantId: string, dto: UpdateTenantSelfDto) {
    const data: Prisma.TenantUpdateInput = {};
    if (dto.brandName !== undefined) data.brandName = dto.brandName;
    if (dto.themeColor !== undefined) data.themeColor = dto.themeColor;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.descriptionAz !== undefined) data.descriptionAz = dto.descriptionAz;
    if (dto.descriptionRu !== undefined) data.descriptionRu = dto.descriptionRu;
    if (dto.descriptionEn !== undefined) data.descriptionEn = dto.descriptionEn;
    if (dto.minChargeAmount !== undefined) data.minChargeAmount = dto.minChargeAmount;
    if (dto.chargeStep !== undefined) data.chargeStep = dto.chargeStep;

    const updated = await this.prisma.scoped.tenant.update({
      where: { id: tenantId },
      data,
    });
    return serializeTenant(updated);
  }
}

function serializeTenant(t: {
  id: string;
  brandName: string;
  legalName: string;
  voen: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ePointMerchantId: string | null;
  themeColor: string;
  logoUrl: string | null;
  descriptionAz: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  contactPhone: string | null;
  minChargeAmount: Prisma.Decimal;
  chargeStep: Prisma.Decimal;
  status: string;
  subscriptionStart: Date | null;
  subscriptionEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: t.id,
    brandName: t.brandName,
    legalName: t.legalName,
    voen: t.voen,
    ownerName: t.ownerName,
    ownerEmail: t.ownerEmail,
    ownerPhone: t.ownerPhone,
    ePointMerchantId: t.ePointMerchantId,
    themeColor: t.themeColor,
    logoUrl: t.logoUrl,
    descriptionAz: t.descriptionAz,
    descriptionRu: t.descriptionRu,
    descriptionEn: t.descriptionEn,
    contactPhone: t.contactPhone,
    minChargeAmount: t.minChargeAmount.toString(),
    chargeStep: t.chargeStep.toString(),
    status: t.status,
    subscriptionStart: t.subscriptionStart?.toISOString() ?? null,
    subscriptionEnd: t.subscriptionEnd?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt?.toISOString() ?? null,
  };
}
