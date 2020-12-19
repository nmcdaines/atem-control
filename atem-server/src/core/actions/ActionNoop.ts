import { ActionType } from 'src/core/actions';
import { IServerAction } from "./index";
import { Device } from '../devices';

export class ActionNoop implements IServerAction<undefined> {
  type: ActionType;
  properties: undefined;

  constructor() {
    this.type = ActionType.NOOP;
  }

  async execute(device: Device) {
    console.log("type: ", this.type);
    console.log("properties: ", this.properties);
    throw Error("Action not implemented");
  }
}