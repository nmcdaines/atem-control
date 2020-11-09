import { ActionType, IAction } from './index';

export interface ISetProgramProperties {
  input: string;
}

export class ActionSetProgram implements IAction<ISetProgramProperties> {
  type: ActionType;
  properties: ISetProgramProperties;

  constructor(props: ISetProgramProperties) {
    this.type = ActionType.SET_PROGRAM;
    this.properties = props;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: this.properties,
    }
  }
}