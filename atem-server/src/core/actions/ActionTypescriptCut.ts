import { ActionType } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export interface ITransitionCutProperties {
  input?: number;
}

export class ActionTransitionCut implements IServerAction<ITransitionCutProperties> {
  type: ActionType;
  properties: ITransitionCutProperties;

  constructor(props: ITransitionCutProperties) {
    this.type = ActionType.TRANSITION_CUT;
    this.properties = props;
  }

  async execute(atem: Atem): Promise<void | undefined> {
    const { input } = this.properties;
    if (input) {
      await atem.changePreviewInput(input);
    }

    await atem.cut();
  }
}