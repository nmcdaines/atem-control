import { ViscaDevice, InquiryCommands } from "sony-visca-connection";
import { Device, IHooks } from './Device';

interface IViscaDeviceMap {
  [key: string]: any;
  pan?: number | undefined;
  tilt?: number | undefined;
  zoom?: number | undefined;
}

export class BirddogDevice extends Device {
  viscaDevice: ViscaDevice;
  private state: IViscaDeviceMap = {};

  constructor(
    public readonly id: string,
    public readonly ipAddress: string,
    public hooks?: IHooks,
  ) {
    super(id, ipAddress, hooks);

    this.viscaDevice = new ViscaDevice(ipAddress);

    this.viscaDevice.on('connected', this.onConnected);
    this.viscaDevice.on('disconnected', this.onDisconnected);
  }

  connect(): void {
    this.status = 'connecting';
    this.viscaDevice.connect();
  }
  disconnect(): void {
    this.status = 'disconnected';
    this.viscaDevice.disconnect();
  }

  private async inquire(): Promise<void> {
    const positionInquiry = new InquiryCommands.PanTiltPositionCommand();
    const zoomInqquiry = new InquiryCommands.ZoomPositionCommand();

    const [positionResponse, zoomResponse]: any = await Promise.all([positionInquiry, zoomInqquiry]);

    this.state = {
      pan: positionResponse?.pan,
      tilt: positionResponse?.tilt,
      zoom: zoomResponse,
    };

    this.onStateChange(this.state);
  }

  private async getInitialState() {
    await this.inquire();
    return this.state;
  }

  onConnected(): void {
    this.status = 'connected';
    super.onConnected();
    this.getInitialState();
  }
  onDisconnected(): void {
    this.status = 'disconnected';
    super.onDisconnected();
  }
  onStateChange(state: IViscaDeviceMap): void {
    super.onStateChange(state);
  }

  getState(): IViscaDeviceMap {
    return this.state;
  }
}  
