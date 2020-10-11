import { Atem } from 'atem-connection';

export interface IAtem {
  ipAddress: string;
  atem: Atem;
  status: 'connecting' | 'connected' | 'disconnected';
}
