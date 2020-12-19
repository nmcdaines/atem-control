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
    const currentState = device?.atem?.state;
    const { direction, source, ...boxDimensions } = this.properties;

    const tasks = [
      device?.atem?.setUpstreamKeyerType({ mixEffectKeyType: MixEffectKeyType.DVE }),
    ];


    if (`${direction}`.length > 0) {
      tasks.push(
        device?.atem?.setUpstreamKeyerOnAir(direction == 'ON')
      );
    }

    if (`${source}`.length > 0) {
      tasks.push(
        device?.atem?.setUpstreamKeyerFillSource(source)
      );
    }

    if (Object.keys(boxDimensions).length > 0) {
      const { positionX, positionY, sizeX, sizeY }: any = boxDimensions;
      if (`${positionX}`.length > 0 && `${positionY}`.length > 0 && `${sizeX}`.length > 0 && `${sizeY}`.length > 0) {
        tasks.push(
          device?.atem?.setUpstreamKeyerDVESettings({
            sizeX: parseInt(sizeX),
            sizeY: parseInt(sizeY),
            positionX: parseInt(positionX),
            positionY: parseInt(positionY),
          })
        );
      }
    };

    await Promise.all(tasks);
  }
}
