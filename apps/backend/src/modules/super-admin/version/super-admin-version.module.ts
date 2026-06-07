import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminVersionController } from './super-admin-version.controller';
import { SuperAdminVersionService } from './super-admin-version.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminVersionController],
  providers: [SuperAdminVersionService],
})
export class SuperAdminVersionModule {}
