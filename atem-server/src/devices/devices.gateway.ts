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
import { Device as DeviceEntity } from './device.entity';

@WebSocketGateway()
export class DevicesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private devicesService: DevicesService
  ) {}
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');


  @SubscribeMessage('device:create')
  async handleDeviceCreate(client: Socket, payload: any) { 
    const device = new DeviceEntity();
    device.name = payload.name;
    device.ipAddress = payload.ipAddress;
    device.type = payload.type;

    this.devicesService.createDevice(device);
  }

  @SubscribeMessage('device:update')
  async handleDeviceUpdate(client: Socket, payload: any) {
    const { id, ...changes } = payload;
    const existingDevice = this.devicesService.getDevice(id);
    this.devicesService.updateDevice(id, changes);
  }

  @SubscribeMessage('device:delete')
  async handleDeviceDelete(client: Socket, payload: any) {
    this.devicesService.deleteDevice(payload.id);
  }

  // Send initial device state
  // @SubscribeMessage('action:state:initial')
  // async handleGetInitialState(client: Socket, payload: string) {
  //   this.logger.log('action:state:initial was called');

  //   const devices = await this.atemService.listDevices();

  //   const atemStates = devices.reduce<any>((acc, val) => {
  //       return {
  //         ...acc,
  //         [val.id]: this.atemService.getAtem(val.id).atem?.state,
  //       }
  //   }, {});

  //   client.emit('state:initial', atemStates);
  // }
  

  afterInit(server: Server) {
    this.devicesService.server = this.server;
    this.devicesService.handleTryConnect();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }
}
