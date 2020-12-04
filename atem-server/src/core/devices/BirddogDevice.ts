import { ViscaDevice, InquiryCommands } from "sony-visca-connection";
import { Device, IHooks } from './Device';

const POLL_TIME = 200;

interface IViscaDeviceMap {
  [key: string]: any;
  pan?: number | undefined;
  tilt?: number | undefined;
  zoom?: number | undefined;
}

export class BirddogDevice extends Device {
  viscaDevice: ViscaDevice;
  private state: IViscaDeviceMap = {};
  private timeout?: NodeJS.Timeout;

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
    this._status = 'connecting';
    this.viscaDevice.connect();
  }
  disconnect(): void {
    this._status = 'disconnected';
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

  onConnected = (): void => {
    this._status = 'connected';
    super.onConnected();
    this.getInitialState();
    this.timeout = setInterval(this.inquire, POLL_TIME);
  }
  onDisconnected = (): void => {
    this._status = 'disconnected';
    super.onDisconnected();
    clearInterval(this.timeout);
  }
  onStateChange = (state: IViscaDeviceMap): void => {
    super.onStateChange(state);
  }

  getState(): IViscaDeviceMap {
    return this.state;
  }

  destroy(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }
}  
