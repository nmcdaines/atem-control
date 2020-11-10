import { ActionType, IAction } from './index';

export class ActionNoop implements IAction<undefined> {
  type: ActionType;
  properties: undefined;

  constructor() {
    this.type = ActionType.NOOP;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: undefined,
    }
  }
}