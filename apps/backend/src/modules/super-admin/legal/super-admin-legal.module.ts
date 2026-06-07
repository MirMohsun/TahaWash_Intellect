import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminLegalController } from './super-admin-legal.controller';
import { SuperAdminLegalService } from './super-admin-legal.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminLegalController],
  providers: [SuperAdminLegalService],
})
export class SuperAdminLegalModule {}
