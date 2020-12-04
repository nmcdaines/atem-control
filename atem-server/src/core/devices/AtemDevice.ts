import { Atem, AtemState } from "atem-connection";
import { Device, IHooks } from "./Device";

export class AtemDevice extends Device {
    public atem: Atem;
  
    constructor(
      public readonly id: string,
      public readonly ipAddress: string,
      public hooks?: IHooks,
    ) {
      super(id, ipAddress, hooks);
      
      this.atem = new Atem({ address: ipAddress });
  
      this.atem.on('connected', this.onConnected);
      this.atem.on('disconnected', this.onDisconnected);
      this.atem.on('stateChanged', this.onStateChange);
    }
  
    connect(): Promise<void> {
      this._status = 'connecting';
      return this.atem.connect(this.ipAddress);
    }
    disconnect(): Promise<void> {
      return this.atem.disconnect();
    }

    /* NOTE: an anonymous function is required in order to
     * to bind onConnected, onDisconnected, and onStateChange
     * to this class instance instead of the Atem class instance
     */
    onConnected = (): void => {
      super.onConnected();
    }
    onDisconnected = (): void => {
      super.onDisconnected();
    }
    onStateChange = (state: AtemState): void => {
      super.onStateChange(state);
    }
  
    getState(): AtemState {
      return this.atem?.state;
    }

    async destroy(): Promise<void> {
      this._status = 'disconnected';
      await this.atem.destroy();
    }

    getAtem(): Atem {
        return this.atem;
    }
  }
