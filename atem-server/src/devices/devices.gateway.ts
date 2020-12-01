import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { DevicesService } from './devices.service';

@WebSocketGateway()
export class DevicesGateway {
  constructor(
    private devicesService: DevicesService
  ) {}
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');


  @SubscribeMessage('device:create')
  handleDeviceCreate(client: Socket, payload: any) { 
    
  }

  @SubscribeMessage('device:update')
  handleDeviceUpdate(client: Socket, payload: string) {

  }

  @SubscribeMessage('device:delete')
  handleDeviceDelete(client: Socket, payload: string) {
    
  }
}
