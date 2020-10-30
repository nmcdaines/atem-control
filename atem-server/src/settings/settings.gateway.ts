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

@WebSocketGateway()
export class SettingsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  @SubscribeMessage('device:create')
  handleDeviceCreate(client: Socket, payload: string) {

  }

  @SubscribeMessage('device:update')
  handleDeviceUpdate(client: Socket, payload: string) {

  }

  @SubscribeMessage('device:delete')
  handleDeviceDelete(client: Socket, payload: string) {

  }

  @SubscribeMessage('initialstate:create')
  handleInitialStateCreate(client: Socket, payload: string) {

  }

  @SubscribeMessage('initialstate:update')
  handleInitialStateUpdate(client: Socket, payload: string) {

  }

  @SubscribeMessage('initialstate:delete')
  handleInitialStateDelete(client: Socket, payload: string) {

  }


  afterInit(server: Server) {
    this.logger.log('Init');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }
}
