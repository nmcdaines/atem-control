import {Inject, Injectable} from '@nestjs/common';
import {AtemService} from "../atem/atem.service";

import { objectToAction, IServerAction } from 'src/core/actions';

@Injectable()
export class ActionsService {
  constructor(
    private atemService: AtemService
  ) {}


  execute = async (deviceId: string, type: string, payload: any) => {
    const action: IServerAction<any> = objectToAction(type, payload);

    console.log(action);

    const atem = this.atemService.getAtem(deviceId).atem;
    if (!atem) { return; }
    await action.execute(atem);
  }
}
