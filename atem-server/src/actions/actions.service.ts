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
    console.log(deviceId, type, payload);

    const action: IServerAction<any> = objectToAction(type, payload);

    const connection: any = this.devicesService.getConnection(deviceId);

    console.log(connection);

    await action.execute(connection);
  }
}
