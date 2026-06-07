import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminFeaturedController } from './super-admin-featured.controller';
import { SuperAdminFeaturedService } from './super-admin-featured.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminFeaturedController],
  providers: [SuperAdminFeaturedService],
})
export class SuperAdminFeaturedModule {}
