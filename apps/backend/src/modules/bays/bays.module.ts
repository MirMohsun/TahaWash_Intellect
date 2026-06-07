import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BaysController } from './bays.controller';
import { BaysService } from './bays.service';
import { QrService } from './qr.service';

@Module({
  imports: [AuthModule],
  controllers: [BaysController],
  providers: [BaysService, QrService],
  exports: [BaysService, QrService],
})
export class BaysModule {}
