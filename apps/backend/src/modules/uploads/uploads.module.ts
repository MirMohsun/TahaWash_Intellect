import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { R2Service } from './r2.service';
import { SuperAdminUploadsController } from './super-admin-uploads.controller';
import { TenantPhotosService } from './tenant-photos.service';
import { TenantUploadsController } from './tenant-uploads.controller';
import { UploadsService } from './uploads.service';

/**
 * R2-backed uploads + tenant photo gallery.
 *
 * AuthModule is imported so TenantAuthGuard / @CurrentTenant() can
 * resolve inside this module's controller.
 *
 * Everything else is self-contained — R2Service reads its config at
 * boot and stays singleton, UploadsService composes R2 + key naming,
 * TenantPhotosService composes Prisma + R2 for cleanup-on-delete.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TenantUploadsController, SuperAdminUploadsController],
  providers: [R2Service, UploadsService, TenantPhotosService],
  // R2Service is exported so the orphan-cleanup cron (JobsModule) can reuse
  // the same singleton (and its boot-time CORS config) rather than spin up
  // a second client.
  exports: [R2Service],
})
export class UploadsModule {}
