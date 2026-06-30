import { Module } from '@nestjs/common';
import { HardwareModule } from '../hardware/hardware.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TenantReportsController } from './tenant-reports.controller';
import { TenantReportsService } from './tenant-reports.service';

@Module({
  imports: [PrismaModule, HardwareModule],
  controllers: [TenantReportsController],
  providers: [TenantReportsService],
})
export class TenantReportsModule {}
