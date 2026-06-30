import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HardwareAckTimeoutService } from './hardware-ack-timeout.service';
import { HardwareListenerService } from './hardware-listener.service';
import { HardwareService } from './hardware.service';
import { SnapshotCoordinator } from './snapshot-coordinator.service';

@Module({
  imports: [PrismaModule],
  providers: [
    HardwareService,
    HardwareListenerService,
    HardwareAckTimeoutService,
    SnapshotCoordinator,
  ],
  exports: [HardwareService, SnapshotCoordinator],
})
export class HardwareModule {}
