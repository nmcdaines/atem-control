import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import {Logger} from '@nestjs/common';
import {Server, Socket} from 'socket.io';
import {AtemService} from "../atem/atem.service";

import {Commands} from 'atem-connection';
import {IsAtKeyFrame} from "atem-connection/dist/enums";
import {MacrosService} from "./macros.service";
import { Macro } from "./macro.entity";
import {IStep} from "./step.interface";

interface IMacro {
    id?: string;
    name?: string;
    description?: string;
    steps: IStep[];
    device: string;
}

@WebSocketGateway()
export class MacrosGateway {
    constructor(
      private readonly macroService: MacrosService,
      private readonly atemService: AtemService,
    ) {}

    @WebSocketServer() server: Server;
    private logger: Logger = new Logger('MacrosGateway');

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
}