import { Atem, AtemState } from "atem-connection";
import { Device, IHooks } from "./Device";

export class AtemDevice extends Device {
    atem: Atem;
  
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
      this.status = 'connecting';
      return this.atem.connect(this.ipAddress);
    }
    disconnect(): Promise<void> {
      return this.atem.disconnect();
    }
    onConnected(): void {
      super.onConnected();
    }
    onDisconnected(): void {
      super.onDisconnected();
    }
    onStateChange(state: AtemState): void {
      super.onStateChange(state);
    }
  
    getState(): AtemState {
      return this.atem.state;
    }
  }
