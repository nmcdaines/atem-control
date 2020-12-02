import {Inject, Injectable} from '@nestjs/common';
import { DevicesService } from "../devices/devices.service";

import { objectToAction, IServerAction } from 'src/core/actions';
import { Device, AtemDevice } from 'src/core/devices';

@Injectable()
export class ActionsService {
  constructor(
    private devicesService: DevicesService
  ) {}


  execute = async (deviceId: string, type: string, payload: any) => {
    const action: IServerAction<any> = objectToAction(type, payload);

    console.log(action);

    const connection = this.devicesService.getConnection(deviceId);

    if (
      !connection || 
      !(connection instanceof AtemDevice) || 
      !connection?.atem
    ) { return; }
    await action.execute(connection.atem);
  }
}
