import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export interface ISetInputNameProperties {
  input: number;
  longName: string;
  shortName: string;
}

export class ActionSetInputName implements IServerAction<ISetInputNameProperties> {
  type: ActionType;
  properties: ISetInputNameProperties;

  constructor(props: ISetInputNameProperties) {
    this.type = ActionType.SET_INPUT_NAME;
    this.properties = props;
  }

  async execute(atem: Atem): Promise<void | undefined> {
    await atem.setInputSettings({
      ...this.properties,
    })
  }
}