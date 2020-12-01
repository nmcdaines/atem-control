import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesGateway } from './devices.gateway';

@Module({
  providers: [DevicesService, DevicesGateway]
})
export class DevicesModule {}
