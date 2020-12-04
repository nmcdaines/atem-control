import { ActionType, IAction } from 'atem-lib';
import { IServerAction } from "./index";
import { BirddogDevice } from '../devices';
import { ViscaCommands } from 'sony-visca-connection';

export interface IViscaSetZoomProperties {
  zoom: number;
}

export class ActionAtemBirddogZoom implements IServerAction<IViscaSetZoomProperties> {
  type: ActionType;
  properties: IViscaSetZoomProperties;

  constructor(props: IViscaSetZoomProperties) {
    this.type = ActionType.VISCA_SET_ZOOM;
    this.properties = props;
  }

  async execute(device: BirddogDevice): Promise<void | undefined> {
    const zoomCommand = new ViscaCommands.ZoomDirectCommand();
    zoomCommand.position = this.properties.zoom;
    await device.viscaDevice.sendCommand(zoomCommand);
  }
}