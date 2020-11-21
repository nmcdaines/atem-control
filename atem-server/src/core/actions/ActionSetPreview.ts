import { ActionType } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export interface ISetPreviewProperties {
  input: number;
}

export class ActionSetPreview implements IServerAction<ISetPreviewProperties> {
  type: ActionType;
  properties: ISetPreviewProperties;

  constructor(props: ISetPreviewProperties) {
    this.type = ActionType.SET_PREVIEW;
    this.properties = props;
  }

  async execute(atem: Atem): Promise<void | undefined> {
    await atem.changePreviewInput(this.properties.input);
  }
}