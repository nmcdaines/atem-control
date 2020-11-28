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
import { AtemService } from "./atem.service";
import { Device } from "./device.entity";
// import {} from ""

import { ViscaCommands, ViscaDevice } from 'sony-visca-connection';

const device = new ViscaDevice('192.168.1.28');

@WebSocketGateway()
export class AtemGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(private atemService: AtemService) {
  }

  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('AppGateway');

  @SubscribeMessage('camera:pantilt')
  handleCameraPanTilt(client: Socket, payload: any) {
    console.log('handleCameraPanTilt', payload);

    const cmd = new ViscaCommands.PanTiltDirectDriveCommand();
    cmd.panSpeed = payload.panSpeed;
    cmd.tiltSpeed = payload.tiltSpeed;

    cmd.panPosition = payload.panPosition;
    cmd.tiltPosition = payload.tiltPosition;

    device.sendCommand(cmd);
  }

  @SubscribeMessage('camera:zoom')
  handeCameraZoom(client: Socket, payload: any) {
    console.log('handeCameraZoom', payload);

    const cmd = new ViscaCommands.ZoomDirectCommand();

    cmd.position = payload.position;

    device.sendCommand(cmd);
  }

  @SubscribeMessage('device:create')
  handleDeviceCreate(client: Socket, payload: any) {
    console.log('was called');
    console.log(payload);

    const device = new Device();
    device.name = payload.name;
    device.ipAddress = payload.ipAddress;

    this.atemService.createDevice(device);
  }

  @SubscribeMessage('device:update')
  handleDeviceUpdate(client: Socket, payload: string) {

  }

  @SubscribeMessage('device:delete')
  handleDeviceDelete(client: Socket, payload: string) {
    // this.atemService.deleteDevice(payload: id);
  }

  @SubscribeMessage('action:state:initial')
  async handleGetInitialState(client: Socket, payload: string) {
    this.logger.log('action:state:initial was called');

    const devices = await this.atemService.listDevices();

    const atemStates = devices.reduce<any>((acc, val) => {
        return {
          ...acc,
          [val.id]: this.atemService.getAtem(val.id).atem?.state,
        }
    }, {});

    client.emit('state:initial', atemStates);
  }

  @SubscribeMessage('ptz')
  async ptx(client: Socket, payload: string) {

  }

  afterInit(server: Server) {
    this.atemService.server = this.server;
    this.atemService.handleTryConnect();
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }
}
