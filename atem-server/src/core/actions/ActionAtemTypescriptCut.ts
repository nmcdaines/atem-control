import { ActionType } from 'src/core/actions';
import { IServerAction } from "./index";
import { AtemDevice } from '../devices';

export interface ITransitionCutProperties {
  input?: number;
}

export class ActionAtemTransitionCut implements IServerAction<ITransitionCutProperties> {
  type: ActionType;
  properties: ITransitionCutProperties;

  constructor(props: ITransitionCutProperties) {
    this.type = ActionType.TRANSITION_CUT;
    this.properties = props;
  }

  async execute(device: AtemDevice): Promise<void | undefined> {
    const { input } = this.properties;
    if (input) {
      await device?.atem?.changePreviewInput(input);
    }

    await device?.atem?.cut();
  }
}