import {ActionType, IAction} from './index';

export enum IDirection {
  ON = "ON",
  OFF = "OFF"
}

export interface ISetPiPProperties {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  direction: IDirection;
}

export class ActionSetPiP implements IAction<ISetPiPProperties> {
  type: ActionType;
  properties: ISetPiPProperties;

  constructor(props: ISetPiPProperties) {
    this.type = ActionType.SET_PIP;
    this.properties = props;
  }

  getMessage = () => {
    return {
      type: this.type,
      properties: this.properties,
    }
  }
}
