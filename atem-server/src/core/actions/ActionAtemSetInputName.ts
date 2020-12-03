import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { AtemDevice } from '../devices';

export interface ISetInputNameProperties {
  input: number;
  longName: string;
  shortName: string;
}

export class ActionAtemSetInputName implements IServerAction<ISetInputNameProperties> {
  type: ActionType;
  properties: ISetInputNameProperties;

  constructor(props: ISetInputNameProperties) {
    this.type = ActionType.SET_INPUT_NAME;
    this.properties = props;
  }

  async execute(device: AtemDevice): Promise<void | undefined> {
    await device?.atem?.setInputSettings({
      ...this.properties,
    })
  }
}