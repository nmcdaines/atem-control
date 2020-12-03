import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { AtemDevice } from '../devices';

export interface ISetProgramProperties {
  input: number;
}

export class ActionAtemSetProgram implements IServerAction<ISetProgramProperties> {
  type: ActionType;
  properties: ISetProgramProperties;

  constructor(props: ISetProgramProperties) {
    this.type = ActionType.SET_PROGRAM;
    this.properties = props;
  }

  async execute(device: AtemDevice): Promise<void | undefined> {
    await device?.atem?.changeProgramInput(this.properties.input);
  }
}