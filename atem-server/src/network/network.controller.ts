import { Controller, Get } from '@nestjs/common';
import { NetworkService } from './network.service';

@Controller('network')
export class NetworkController {
  constructor(private readonly networkService: NetworkService){}

  // @Get()
  // getHello(): string {
  //   return 'hello world'
  // }

  @Get()
  async getDevices(): Promise<any> {
    return await this.networkService.discover();
  }
}
