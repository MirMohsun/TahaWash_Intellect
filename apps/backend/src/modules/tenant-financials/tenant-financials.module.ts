import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantFinancialsController } from './tenant-financials.controller';
import { TenantFinancialsService } from './tenant-financials.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantFinancialsController],
  providers: [TenantFinancialsService],
})
export class TenantFinancialsModule {}
