import { Module } from '@nestjs/common';
import { NetworkService } from './network.service';
import { NetworkGateway } from './network.gateway';
import { NetworkController } from './network.controller';

@Module({
  imports: [],
  controllers: [NetworkController],
  providers: [NetworkService, NetworkGateway],
})
export class NetworkModule {}
