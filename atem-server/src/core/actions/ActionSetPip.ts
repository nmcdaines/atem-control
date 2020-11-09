import {Atem} from "atem-connection";
import { ActionType, IAction } from "./index";

export interface ISetProgramProperties {
  input: string;
}

export class ActionSetPip implements IAction<ISetProgramProperties> {
  type: ActionType;
  properties: ISetProgramProperties;

  constructor(props: ISetProgramProperties) {
    this.type = ActionType.SET_PROGRAM;
    this.properties = props;
  }

  execute(atem: Atem) {
    atem.setUpstreamKeyerDVESettings({

    })
  }
}
