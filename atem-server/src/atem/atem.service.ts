import { Injectable, Logger } from '@nestjs/common';
import { IAtem } from './atem.interface';
import { Atem, AtemState } from 'atem-connection';

@Injectable()
export class AtemService {
  private readonly logger: Logger = new Logger('AtemService');
  private readonly devices: Array<IAtem> = [];

  getDevice(ipAddress: string) {
    const device = this.devices.find((device) => device.ipAddress === ipAddress);
    return device;
  }

  setDevice(ipAddress: string, device: IAtem) {
    const deviceIndex = this.devices.findIndex((device) => device.ipAddress === ipAddress);
    if (deviceIndex < 0) { return; }
    this.devices[deviceIndex] = { ...device };
  }

  updateDevice(ipAddress: string, changes: Partial<IAtem>) {
    const device = this.devices.find((device) => device.ipAddress === ipAddress);
    return this.setDevice(ipAddress, { ...device, ...changes });
  }

  async connect(ipAddress: string) {
    if (this.getDevice(ipAddress)) {
      return { error: 'Device already exists' }
    }

    const device: IAtem = {
      ipAddress,
      atem: new Atem(),
      status: 'connecting',
    };
    
    device.atem.on('connected', this.onConnected(ipAddress));
    device.atem.on('disconnected', this.onDisconnected(ipAddress));
    device.atem.on('stateChanged', this.onStateChange(ipAddress));
    
    await device.atem.connect(ipAddress);
  }

  // TODO: emit event for [on] connect/disconnect
  private onConnected = (ipAddress) => () => this.updateDevice(ipAddress, { status: 'connected' });
  private onDisconnected = (ipAddress) => () => this.updateDevice(ipAddress, { status: 'disconnected' });
  private onStateChange = (ipAddress) => (state: AtemState, pathToChange) => {
    // handle state changes here
  }


  async setProgram(ipAddress: string, input: number, me?: number) {
    const device = this.getDevice(ipAddress);
    await device.atem.changeProgramInput(input, me);
  }

  async setPreview(ipAddress: string, input: number, me?: number) {
    const device = this.getDevice(ipAddress);
    await device.atem.changePreviewInput(input, me);
  }


  async disconnect(ipAddress) {
    const device = this.getDevice(ipAddress);

    if (!device) {
      return { error: 'device not connected' };
    }

    await device.atem.disconnect();
  }

}
