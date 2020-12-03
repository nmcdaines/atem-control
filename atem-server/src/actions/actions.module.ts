import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsGateway } from './actions.gateway';
import { DevicesModule } from 'src/devices/devices.module';

@Module({
  imports: [DevicesModule],
  providers: [ActionsService, ActionsGateway],
  exports: [ActionsService],
})
export class ActionsModule {}
