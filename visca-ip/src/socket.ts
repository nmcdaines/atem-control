

import { EventEmitter } from "events";
import {createSocket, Socket} from "dgram";

interface IViscaSocketOptions {
    address?: string;
    port?: number;
    debug?: boolean;
    log?: (...args) => void; /* TODO: unsure if we need this line */
}

export class ViscaSocket extends EventEmitter {
    private _debug = false;
    private _reconnectTime: NodeJS.Timer | undefined;
    private _retransmitTimer: NodeJS.Timer | undefined;
    // private _connectionState

    private _localPacketId = 0;
    private _maxPacketId = 0xffffffff;

    private _address: string;
    private _port: number = 52381;
    private _socket: Socket;
    private _reconnectInterval = 5000;

    private _inFlightTimeout = 1000;
    private _maxRetries = 5;
    private _lastReceivedAt: number = Date.now();
    // private _inFlight: QueuedCommand & { lastSent: number, resent: number } | undefined
    // private _queue: Array<QueuedCommand> = []

    constructor(options: IViscaSocketOptions) {
        super();

        this._address = options.address || this._address;
        this._port = options.port || this._port;
        this._debug = options.debug || false;
        this.log = options.log || this.log;

        this._createSocket();
    }

    public connect(address?: string, port?: number) {

    }

    private log(..._args: any[]):void {
        // Will be reassigned by the top-level class
    }

    private _createSocket() {
        this._socket = createSocket('udp4');
        this._socket.bind()
        this._socket.on('message', (packet, requestInfo) => this._receivePacket(packet, requestInfo) /* TODO: determine if need anonymous function */);
        this._socket.on('close', () => this.emit('disconnected'));
    }

    private _receivePacket(packet: Buffer, requestInfo: any) {
        /* Determine how to communicate with the BirdDog camera here */
        //TODO
        // this._inFlight = undefined;
        this._sendNextPacket();
    }

    private _sendNextPacket() {
        // TODO
        // if (this._inFlight)
    }

    private _checkForRetransmit() {
        // TODO
    }
}