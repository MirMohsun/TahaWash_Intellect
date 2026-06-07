import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { SuperAdminPromosController } from './super-admin-promos.controller';
import { SuperAdminPromosService } from './super-admin-promos.service';

@Module({
  imports: [AuthModule],
  controllers: [SuperAdminPromosController],
  providers: [SuperAdminPromosService],
})
export class SuperAdminPromosModule {}
