import {ActionType} from 'atem-lib';
import {IServerAction} from "./index";
import {Atem} from "atem-connection";
import {MixEffectKeyType} from "atem-connection/dist/enums";

export enum EDirection {
  ON = "ON",
  OFF = "OFF"
}

export interface ISetPiPProperties {
  positionX?: number;
  positionY?: number;
  sizeX?: number;
  sizeY?: number;
  direction?: EDirection;
  source?: number;
}

export class ActionSetPiP implements IServerAction<ISetPiPProperties> {
  type: ActionType;
  properties: ISetPiPProperties;

  constructor(props: ISetPiPProperties) {
    this.type = ActionType.SET_PIP;
    this.properties = props;
  }

  async execute(atem: Atem) {
    const { direction, source, ...boxDimensions } = this.properties;

    const tasks = [
      atem.setUpstreamKeyerType({ mixEffectKeyType: MixEffectKeyType.DVE }),
    ];


    if (direction) {
      tasks.push(
        atem.setUpstreamKeyerOnAir(direction == 'ON')
      );
    }

    await Promise.all(tasks);

    if (source) {
      atem.setUpstreamKeyerFillSource(source);
    }

    if (Object.keys(boxDimensions).length <= 0) return;
    atem.setUpstreamKeyerDVESettings({ ...boxDimensions });
  }
}
