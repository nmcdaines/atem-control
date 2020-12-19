import {ActionType} from 'src/core/actions';
import {IServerAction} from "./index";
import {MixEffectKeyType} from "atem-connection/dist/enums";
import { AtemDevice } from '../devices';

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

export class ActionAtemSetPiP implements IServerAction<ISetPiPProperties> {
  type: ActionType;
  properties: ISetPiPProperties;

  constructor(props: ISetPiPProperties) {
    this.type = ActionType.SET_PIP;
    this.properties = props;
  }

  async execute(device: AtemDevice) {
    const { direction, source, ...boxDimensions } = this.properties;

    const tasks = [
      device?.atem?.setUpstreamKeyerType({ mixEffectKeyType: MixEffectKeyType.DVE }),
    ];


    if (direction) {
      tasks.push(
        device?.atem?.setUpstreamKeyerOnAir(direction == 'ON')
      );
    }

    await Promise.all(tasks);

    if (source) {
      device?.atem?.setUpstreamKeyerFillSource(source);
    }

    if (Object.keys(boxDimensions).length <= 0) return;
    device?.atem?.setUpstreamKeyerDVESettings({ ...boxDimensions });
  }
}
