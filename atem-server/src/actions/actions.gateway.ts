import { SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import {Socket} from "socket.io";
import {ActionType} from "atem-lib";
import {objectToAction} from "../core/actions";
import {ActionsService} from "./actions.service";


@WebSocketGateway()
export class ActionsGateway {
  constructor(private actionsService: ActionsService) {}

  @SubscribeMessage('action:execute')
  handleActionExecute(client: Socket, payload: any) {



    const {id, type, properties}: { id: string,
        type: ActionType, properties: any } = payload;

    this.actionsService.execute(id, type, properties);

    // const action = objectToAction(type, properties);

    // console.log(action);

  }

  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }
}
