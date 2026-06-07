import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantTransactionsController } from './tenant-transactions.controller';
import { TenantTransactionsService } from './tenant-transactions.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantTransactionsController],
  providers: [TenantTransactionsService],
})
export class TenantTransactionsModule {}
