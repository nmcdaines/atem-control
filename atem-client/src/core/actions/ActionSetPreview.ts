import { ActionType, IAction } from './index';

export interface ISetPreviewProperties {
  input: string;
}

export class ActionSetProgram implements IAction<ISetPreviewProperties> {
  type: ActionType;
  properties: ISetPreviewProperties;

  constructor(props: ISetPreviewProperties) {
    this.type = ActionType.SET_PREVIEW;
    this.properties = props;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: this.properties,
    }
  }
}