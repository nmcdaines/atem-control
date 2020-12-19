import { ActionType } from 'src/core/actions';
import { IServerAction } from "./index";
import { AtemDevice } from '../devices';

export interface ISetPreviewProperties {
  input: number;
}

export class ActionAtemSetPreview implements IServerAction<ISetPreviewProperties> {
  type: ActionType;
  properties: ISetPreviewProperties;

  constructor(props: ISetPreviewProperties) {
    this.type = ActionType.SET_PREVIEW;
    this.properties = props;
  }

  async execute(device: AtemDevice): Promise<void | undefined> {
    if (!device?.atem) { return; }
    await device?.atem.changePreviewInput(this.properties.input);
  }
}