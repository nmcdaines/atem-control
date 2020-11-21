import { Injectable, Logger } from '@nestjs/common';
import { IAtem } from './atem.interface';
import { Atem, AtemState } from 'atem-connection';
import { WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Device } from './device.entity';
import {InjectRepository} from "@nestjs/typeorm";
import {Repository} from "typeorm";


@Injectable()
export class AtemService {
  private readonly logger: Logger = new Logger('AtemService');
  private atemConnections: Map<string, IAtem> = new Map();

  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  @WebSocketServer() server: Server;


  private destroyAtemConnection(atemId: string) {
    this.atemConnections.get(atemId)?.atem?.destroy();
    return this.atemConnections.delete(atemId);
  }

  private async createAtem(device: Device) {
      const {id, ipAddress} = device;
      const connection: IAtem = {
        ipAddress: device.ipAddress,
        status: 'unknown',
        reconnect: true,
        atem: new Atem(),
      }

      connection.atem.on('connected', this.onConnected(id));
      connection.atem.on('disconnected', this.onDisconnected(id));
      connection.atem.on('stateChanged', this.onStateChange(id));

      await connection.atem.connect(ipAddress);

      return connection;
    }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleTryConnect() {
    this.logger.debug('Method: Try Connect called');

    const atemIds = Object.keys(this.atemConnections);
    this.logger.debug('Existing atem ids', JSON.stringify(atemIds));

    const devices = await this.deviceRepository.find();
    const deviceIds = new Set(devices.map((device) => device.id));



    // Remove any atems that are stale
    await Promise.all(
      atemIds.map((atemId) => {
        if (deviceIds.has(atemId)) { return; }
        return this.destroyAtemConnection(atemId);
      })
    );

    this.logger.debug("devices", JSON.stringify(devices));

    await Promise.all(
      devices.map(async (device) => {
        const existingConnection = this.atemConnections.get(device.id);
        const ipChanged = device.ipAddress != existingConnection?.ipAddress;
        // TODO: Reconnect if disconnected

        this.logger.log(`${device.id}, ${!!existingConnection}, ${ipChanged}`);
        if (existingConnection && !ipChanged) { return; }
        this.destroyAtemConnection(device.id);

        const connection = await this.createAtem(device);
        this.atemConnections.set(device.id, connection);
      })
    );
  }

  private updateConnection = (id: string, change: Partial<IAtem>) => {
    const connection = this.atemConnections.get(id);
    this.atemConnections.set(id, {
      ...connection,
      ...change,
    });
  }

  private onConnected = (id) => () => {
    console.log('connected to ' + id + 'successful');
    this.updateConnection(id, { status: 'connected' });
  }
  private onDisconnected = (id) => () => {
    this.updateConnection(id, { status: 'disconnected' });
  }
  private onStateChange = (id) => (state: AtemState, pathToChange) => {
    // console.log(this.server)
    this.logger.log("state changed", pathToChange);
    this.server.emit('state:change', { id, state, pathToChange });
  }

  public listDevices(): Promise<Device[]> {
    return this.deviceRepository.find();
  }

  public getDevice(id: string): Promise<Device> {
    return this.deviceRepository.findOne({ id });
  }

  public createDevice(device: Device) {
    return this.deviceRepository.insert(device);
  }

  public updateDevice(id: string, changes: Partial<Device>) {
    return this.deviceRepository.update(id, changes);
  }

  public deleteDevice(id: string) {
    return this.deviceRepository.delete(id);
  }

  public getAtem(deviceId: string) {
    return this.atemConnections.get(deviceId);
  }
}
