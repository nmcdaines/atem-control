import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { DevicesService } from "../devices/devices.service";

import { Commands } from 'atem-connection';
import { IsAtKeyFrame } from "atem-connection/dist/enums";
import { MacrosService } from "./macros.service";
import { Macro } from "./macro.entity";
import { IStep } from "./step.interface";
import { ActionsService } from 'src/actions/actions.service';
import { ViscaCommands, ViscaDevice } from 'sony-visca-connection';


interface IMacro {
  id?: string;
  name?: string;
  description?: string;
  steps: IStep[];
  device: string;
}

const viscaDevice = new ViscaDevice('192.168.1.28');

@WebSocketGateway()
export class MacrosGateway {
  constructor(
    private readonly macroService: MacrosService,
    private readonly devicesService: DevicesService,
    private readonly actionsService: ActionsService,
  ) { }

  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('MacrosGateway');

  @SubscribeMessage('camera:pantilt')
  async handleCameraPanTilt(client: Socket, payload: any) {
    this.logger.log('handleCameraPanTilt', payload);
    console.log(payload);

    const cmd = new ViscaCommands.PanTiltDirectDriveCommand();
    cmd.panSpeed = payload.panSpeed;
    cmd.tiltSpeed = payload.tiltSpeed;

    cmd.panPosition = payload.panPosition;
    cmd.tiltPosition = payload.tiltPosition;

    await viscaDevice.sendCommand(cmd);
  }

  @SubscribeMessage('camera:zoom')
  async handeCameraZoom(client: Socket, payload: any) {
    // this.logger.log('handeCameraZoom');
    console.log(payload);

    const cmd = new ViscaCommands.ZoomDirectCommand();

    cmd.position = payload.position;

    await viscaDevice.sendCommand(cmd);
  }

  @SubscribeMessage('macro:create')
  handleMacroCreate(client: Socket, payload: IMacro) {
    const macro = new Macro();
    macro.name = payload.name;
    macro.description = payload.description;
    macro.steps = payload.steps;
    macro.device = payload.device;

    return this.macroService.createMacro(macro);
  }

  @SubscribeMessage('macro:update')
  handleMacroUpdate(client: Socket, payload: IMacro) {
    const macro = new Macro();
    macro.name = payload.name;
    macro.description = payload.description;
    macro.steps = payload.steps;
    macro.device = payload.device;

    return this.macroService.updateMacro(payload.id, macro);
  }

  @SubscribeMessage('macro:delete')
  handleMacroDelete(client: Socket, payload: string) {
    return this.macroService.deleteMacro(payload);
  }

  @SubscribeMessage('macro:execute')
  async handleMacroExecute(client: Socket, payload: IMacro) {
    await Promise.all(payload.steps.map(async (step) => {
      if (step.device === 'atem') {
        // TODO: not sure that we need to execute this on all devices
        
        const devices = await this.devicesService.listDevices();
        await Promise.all(devices.map(async (device) => {
          await this.actionsService.execute(device.id, step.command, step.properties);
        }))
      } else if (step.device === 'camera') {
        const payload = step.properties;

        const panTiltCommand = new ViscaCommands.PanTiltDirectDriveCommand();
        panTiltCommand.panSpeed = payload.panSpeed;
        panTiltCommand.tiltSpeed = payload.tiltSpeed;
        panTiltCommand.panPosition = payload.panPosition;
        panTiltCommand.tiltPosition = payload.tiltPosition;
        viscaDevice.sendCommand(panTiltCommand);


        const zoomCommand = new ViscaCommands.ZoomDirectCommand();
        zoomCommand.position = payload.position;
        viscaDevice.sendCommand(zoomCommand);
      }
    }));
  }
}