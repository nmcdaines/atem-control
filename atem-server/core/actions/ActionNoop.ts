import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export class ActionNoop implements IServerAction<undefined> {
  type: ActionType;
  properties: undefined;

  constructor() {
    this.type = ActionType.NOOP;
  }

  async execute(atem: Atem) {
    console.log("type: ", this.type);
    console.log("properties: ", this.properties);
    throw Error("Action not implemented");
  }
}