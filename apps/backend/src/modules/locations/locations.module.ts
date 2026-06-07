import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadsModule } from '../uploads/uploads.module';
import { LocationPhotosController } from './location-photos.controller';
import { LocationPhotosService } from './location-photos.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  // UploadsModule exports R2Service (used by LocationPhotosService for
  // delete-time object cleanup).
  imports: [AuthModule, UploadsModule],
  controllers: [LocationsController, LocationPhotosController],
  providers: [LocationsService, LocationPhotosService],
  exports: [LocationsService],
})
export class LocationsModule {}
