import { ActionType } from 'atem-lib';
import { IServerAction } from "./index";
import { AtemDevice } from '../devices';

export interface ITransitionAutoProperties {
  input?: number;
}

export class ActionAtemTransitionAuto implements IServerAction<ITransitionAutoProperties> {
  type: ActionType;
  properties: ITransitionAutoProperties;

  constructor(props: ITransitionAutoProperties) {
    this.type = ActionType.TRANSITION_AUTO;
    this.properties = props;
  }

  async execute(device: AtemDevice): Promise<void | undefined> {
    const { input } = this.properties;
    if (input) {
      await device?.atem?.changePreviewInput(input);
    }

    await device?.atem?.autoTransition();
  }
}