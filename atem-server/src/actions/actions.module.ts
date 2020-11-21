import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsGateway } from './actions.gateway';
import {AtemModule} from "../atem/atem.module";

@Module({
  imports: [AtemModule],
  providers: [ActionsService, ActionsGateway],
  exports: [ActionsService],
})
export class ActionsModule {}
