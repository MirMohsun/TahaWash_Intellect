import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminAuditLogsController } from './super-admin-audit-logs.controller';
import { SuperAdminAuditLogsService } from './super-admin-audit-logs.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminAuditLogsController],
  providers: [SuperAdminAuditLogsService],
})
export class SuperAdminAuditLogsModule {}
