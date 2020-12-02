import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';
import { Device } from './device.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [DevicesService, DevicesGateway],
  exports: [DevicesService],
})
export class DevicesModule {}
