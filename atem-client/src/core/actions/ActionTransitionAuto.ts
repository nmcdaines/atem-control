import { ActionType, IAction } from './index';

export interface ITransitionAutoProperties {
  input?: string;
}

export class ActionTransitionAuto implements IAction<ITransitionAutoProperties> {
  type: ActionType;
  properties: ITransitionAutoProperties;

  constructor(props: ITransitionAutoProperties) {
    this.type = ActionType.TRANSITION_AUTO;
    this.properties = props;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: this.properties,
    }
  }
}