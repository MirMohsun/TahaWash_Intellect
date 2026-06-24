import { Module } from '@nestjs/common';
import { HardwareModule } from '../hardware/hardware.module';
import { PrismaModule } from '../prisma/prisma.module';
import { HardwareAdminController } from './hardware-admin.controller';
import { HardwareAdminService } from './hardware-admin.service';

@Module({
  imports: [PrismaModule, HardwareModule],
  controllers: [HardwareAdminController],
  providers: [HardwareAdminService],
})
export class HardwareAdminModule {}
