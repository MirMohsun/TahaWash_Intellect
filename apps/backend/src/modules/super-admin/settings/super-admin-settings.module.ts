import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminSettingsController } from './super-admin-settings.controller';
import { SuperAdminSettingsService } from './super-admin-settings.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminSettingsController],
  providers: [SuperAdminSettingsService],
})
export class SuperAdminSettingsModule {}
