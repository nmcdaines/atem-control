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
import { Device, AtemDevice, BirddogDevice } from 'src/core/devices';

@WebSocketGateway()
export class DevicesGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private devicesService: DevicesService
  ) {}
  
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('DevicesGateway');


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

  @SubscribeMessage('device:list')
  async handleDevicesList(client: Socket, payload: any) {
    const devices = await this.devicesService.listDevices();
    client.emit('response:device:list', devices);
  }

  // Send initial device state
  @SubscribeMessage('device:state:initial')
  async handleGetInitialState(client: Socket, payload: string) {
    this.logger.log('device:state:initial was called');

    const deviceStates: { [key: string]: any } = {};

    const connections = await this.devicesService.getConnections();
    for (let key of connections.keys()) {
      deviceStates[key] = connections.get(key).getState();
    }

    client.emit('state:initial', deviceStates);
  }
  
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
