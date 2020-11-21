import { ActionType } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export interface ITransitionAutoProperties {
  input?: number;
}

export class ActionTransitionAuto implements IServerAction<ITransitionAutoProperties> {
  type: ActionType;
  properties: ITransitionAutoProperties;

  constructor(props: ITransitionAutoProperties) {
    this.type = ActionType.TRANSITION_AUTO;
    this.properties = props;
  }

  async execute(atem: Atem): Promise<void | undefined> {
    const { input } = this.properties;
    if (input) {
      await atem.changePreviewInput(input);
    }

    await atem.autoTransition();
  }
}