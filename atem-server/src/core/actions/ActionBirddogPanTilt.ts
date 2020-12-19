import { ActionType, IAction } from 'src/core/actions';
import { IServerAction } from "./index";
import { BirddogDevice } from '../devices';
import { ViscaCommands } from 'sony-visca-connection';

export interface IViscaSetPanTiltProperties {
  pan: number;
  tilt: number;
  panSpeed: number;
  tiltSpeed: number;
}

export class ActionAtemBirddogPanTilt implements IServerAction<IViscaSetPanTiltProperties> {
  type: ActionType;
  properties: IViscaSetPanTiltProperties;

  constructor(props: IViscaSetPanTiltProperties) {
    this.type = ActionType.VISCA_SET_PAN_TILT;
    this.properties = props;
  }

  async execute(device: BirddogDevice): Promise<void | undefined> {
    const panTiltCommand = new ViscaCommands.PanTiltDirectDriveCommand();
    panTiltCommand.panPosition = this.properties.pan;
    panTiltCommand.panSpeed = this.properties.panSpeed;
    panTiltCommand.tiltPosition = this.properties.tilt;
    panTiltCommand.tiltSpeed = this.properties.tiltSpeed;

    await device.viscaDevice.sendCommand(panTiltCommand);
  }
}