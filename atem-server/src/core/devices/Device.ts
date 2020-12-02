export interface IHooks {
  onConnected?: any;
  onChange?: any;
  onDisconnected?: any;
}

export abstract class Device {
  status: 'connecting' | 'connected' | 'disconnected' | 'unknown' = 'disconnected';

  constructor(
    public readonly id: string,
    public readonly ipAddress: string,
    public hooks?: IHooks,
  ) { }

  abstract connect(): Promise<void> | void;
  abstract disconnect(): Promise<void> | void;

  onConnected(): void {
    this.status = 'connected';
    if (this.hooks?.onConnected) {
      this.hooks.onConnected(this);
    }
  };
  onDisconnected(): void {
    this.status = 'disconnected';
    if (this.hooks?.onDisconnected) {
      this.hooks.onDisconnected(this);
    }
  };

  abstract getState(): any;
  onStateChange(state): any {
    if (this.hooks?.onChange) {
      this.hooks.onChange(state, this);
    }
  };

  // abstract execute(action: IAction);
  abstract destroy(): Promise<void> | void;
}
