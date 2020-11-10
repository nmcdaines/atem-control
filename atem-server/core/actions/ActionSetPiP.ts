import { ActionType } from 'atem-lib';
import { IServerAction } from "./index";
import { Atem } from "atem-connection";

export enum EDirection {
  ON = "ON",
  OFF = "OFF"
}

export interface ISetPiPProperties {
  positionX?: number;
  positionY?: number;
  sizeX?: number;
  sizeY?: number;
  direction: EDirection;
}

export class ActionSetPiP implements IServerAction<ISetPiPProperties> {
  type: ActionType;
  properties: ISetPiPProperties;

  constructor(props: ISetPiPProperties) {
    this.type = ActionType.SET_PIP;
    this.properties = props;
  }

  async execute(atem: Atem) {
    const { direction, ...boxDimensions } = this.properties;
    atem.setUpstreamKeyerOnAir(direction == 'ON');

    if (Object.keys(boxDimensions).length <= 0) return;
    atem.setUpstreamKeyerDVESettings({ ...boxDimensions });
  }
}
