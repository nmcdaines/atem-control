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
  private state: IViscaDeviceMap = { type: 'birddog' };
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

  private inquire = async (): Promise<void> => {
    const positionInquiry = new InquiryCommands.PanTiltPositionCommand();
    const zoomInqquiry = new InquiryCommands.ZoomPositionCommand();

    const [positionResponse, zoomResponse]: any = await Promise.all([
      this.viscaDevice.sendCommand(positionInquiry),
      this.viscaDevice.sendCommand(zoomInqquiry),
    ]);

    this.onStateChange({
      type: 'birddog',
      pan: positionResponse?.pan,
      tilt: positionResponse?.tilt,
      zoom: zoomResponse,
    });
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
    if (JSON.stringify(this.state) !== JSON.stringify(state)) {
      this.state = state;
      super.onStateChange(state);
    }
  }

  getState(): IViscaDeviceMap {
    return this.state;
  }

  destroy(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }
}  
