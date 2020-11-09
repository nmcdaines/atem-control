import { ActionType, IAction } from './index';

export interface ITransitionCutProperties {
  input?: string;
}

export class ActionTransitionCut implements IAction<ITransitionCutProperties> {
  type: ActionType;
  properties: ITransitionCutProperties;

  constructor(props: ITransitionCutProperties) {
    this.type = ActionType.TRANSITION_CUT;
    this.properties = props;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: this.properties,
    }
  }
}