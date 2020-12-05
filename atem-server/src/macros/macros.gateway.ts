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
  type: string;
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

  @SubscribeMessage('macro:create')
  async handleMacroCreate(client: Socket, payload: IMacro) {
    const macro = new Macro();
    macro.name = payload.name;
    macro.description = payload.description;
    macro.steps = payload.steps;
    macro.device = payload.device;
    macro.type = payload.type;

    console.log(macro);

    await this.macroService.createMacro(macro);
    await this.handleMacroList(client, '');
  }

  @SubscribeMessage('macro:update')
  handleMacroUpdate(client: Socket, payload: IMacro) {
    const macro = new Macro();
    macro.name = payload.name;
    macro.description = payload.description;
    macro.steps = payload.steps;
    macro.device = payload.device;
    macro.type = payload.type;

    return this.macroService.updateMacro(payload.id, macro);
  }

  @SubscribeMessage('macro:delete')
  handleMacroDelete(client: Socket, payload: string) {
    return this.macroService.deleteMacro(payload);
  }

  @SubscribeMessage('macro:list')
  async handleMacroList(client: Socket, payload: string) {
    const macros = await this.macroService.listMacro();
    client.emit('response:macro:list', macros);
  }

  @SubscribeMessage('macro:execute')
  async handleMacroExecute(client: Socket, payload: IMacro) {
    await Promise.all(payload.steps.map(async (step) => {
      await this.actionsService.execute(step.device || payload.device, step.command, step.properties);
    }));
  }

  @SubscribeMessage('macro:execute:id')
  async handleMacroExecuteById(client: Socket, payload: any) {
    console.log('execute', payload);

    const macro = await this.macroService.getMacro(payload.id);

    console.log('macro', macro);

    if (!macro) { return; }

    await Promise.all(macro.steps.map(async (step) => {
      await this.actionsService.execute(step.device || macro.device, step.command, step.properties);
    }));
  }
}