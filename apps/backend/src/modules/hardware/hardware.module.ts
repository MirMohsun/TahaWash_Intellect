import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HardwareAckTimeoutService } from './hardware-ack-timeout.service';
import { HardwareListenerService } from './hardware-listener.service';
import { HardwareService } from './hardware.service';

@Module({
  imports: [PrismaModule],
  providers: [HardwareService, HardwareListenerService, HardwareAckTimeoutService],
  exports: [HardwareService],
})
export class HardwareModule {}
