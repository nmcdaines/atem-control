import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export interface ISetProgramProperties {
  input: number;
}

export class ActionSetProgram implements IServerAction<ISetProgramProperties> {
  type: ActionType;
  properties: ISetProgramProperties;

  constructor(props: ISetProgramProperties) {
    this.type = ActionType.SET_PROGRAM;
    this.properties = props;
  }

  async execute(atem: Atem): Promise<void | undefined> {
    await atem.changeProgramInput(this.properties.input);
  }
}