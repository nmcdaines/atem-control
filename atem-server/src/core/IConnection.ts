import { Atem } from 'atem-connection';

export interface IConnection {
    ipAddress: string;
    instance: Atem | any;
    status: 'connecting' | 'connected' | 'disconnected' | 'unknown';
    reconnect?: boolean;
}
