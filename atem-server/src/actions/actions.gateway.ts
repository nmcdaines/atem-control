import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import {Socket} from "socket.io";
import {ActionType} from "atem-lib";
import {objectToAction} from "../core/actions";
import {ActionsService} from "./actions.service";


interface IActionExecutePayload {
  id: string;
  type: ActionType;
  properties: any;
}

@WebSocketGateway()
export class ActionsGateway {
  constructor(private actionsService: ActionsService) {}

  @SubscribeMessage('action:execute')
  handleActionExecute(client: Socket, payload: any) {
    const {id, type, properties}: IActionExecutePayload = payload;
    this.actionsService.execute(id, type, properties);
  }
}
