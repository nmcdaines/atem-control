export interface IHooks {
  onConnected?: any;
  onChange?: any;
  onDisconnected?: any;
}

export abstract class Device {
  _status: 'connecting' | 'connected' | 'disconnected' | 'unknown';

  constructor(
    public readonly id: string,
    public readonly ipAddress: string,
    public hooks?: IHooks,
  ) {
    this._status = 'disconnected';
  }

  abstract connect(): Promise<void> | void;
  abstract disconnect(): Promise<void> | void;

  onConnected(): void {
    this._status = 'connected';
    if (this.hooks?.onConnected) {
      this.hooks.onConnected(this);
    }
  };
  onDisconnected(): void {
    this._status = 'disconnected';
    if (this.hooks?.onDisconnected) {
      this.hooks.onDisconnected(this);
    }
  };

  abstract getState(): any;
  onStateChange(state): any {
    if (this.hooks?.onChange) {
      this.hooks.onChange({
        ...state
      }, this);
    }
  };

  // abstract execute(action: IAction);
  abstract destroy(): Promise<void> | void;

  public get status() {
    return this._status;
  }
}
