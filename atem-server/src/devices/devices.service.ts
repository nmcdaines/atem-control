import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Device as DeviceEntity } from './device.entity';
import { Device, AtemDevice, BirddogDevice, IHooks } from 'src/core/devices';
import { Repository } from 'typeorm';
import { WebSocketServer } from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class DevicesService {
  private readonly logger: Logger = new Logger('DeviceService');
  private deviceConnections: Map<string, Device | AtemDevice | BirddogDevice> = new Map();

  constructor(
    @InjectRepository(DeviceEntity)
    private deviceRepository: Repository<DeviceEntity>,
  ) {}

  @WebSocketServer() server: Server;

  private async destroyDevice(deviceId: string): Promise<void> {
    this.logger.log(`destroying device ${deviceId}`);
    await this.deviceConnections.get(deviceId)?.destroy();
    this.deviceConnections.delete(deviceId);
  }

  private async createConnection(device: DeviceEntity) {
    const { id, ipAddress, type } = device;
    let connection: Device;

    const hooks: IHooks = {
      onConnected: this.onConnected,
      onDisconnected: this.onDisconnected,
      onChange: this.onStateChange,
    }

    if (type == 'atem') {
      connection = new AtemDevice(id, ipAddress, hooks);
    } else if (type =='birddog') {
      connection = new BirddogDevice(id, ipAddress, hooks);
    }

    if (!connection) { return; }

    await connection.connect();
    
    return connection;
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleTryConnect() {
    const localDeviceIds = Object.keys(this.deviceConnections);
    const remoteDevices = await this.deviceRepository.find();
    const remoteDeviceIds = new Set(remoteDevices.map((device) => device.id));

    // Remove devices that have been removed from db
    const removedDeviceIds = localDeviceIds.filter((deviceId) => !remoteDeviceIds.has(deviceId));
    if (removedDeviceIds.length > 0) {
      this.logger.log(`The following devices have been identified for removal ${JSON.stringify(removedDeviceIds)}`);
    }
    await Promise.all(
      removedDeviceIds.map((deviceId) => this.destroyDevice(deviceId))
    );

    //
    await Promise.all(
      remoteDevices.map(async (device) => {
        console.log(remoteDevices);

        const existingConnection = this.deviceConnections.get(device.id);
        const ipChanged = device.ipAddress != existingConnection?.ipAddress;

        if (existingConnection && existingConnection.status === 'disconnected') {
          this.logger.log(`Attempting to reconnect to: ${device.id}, ${device.ipAddress}`);
          return existingConnection.connect();
        }

        // Device is fine, move on
        if (existingConnection && !ipChanged) { return; }

        await this.destroyDevice(device.id);
        
        const connection = await this.createConnection(device);
        this.deviceConnections.set(device.id, connection); 
      })
    );
  }

  private onConnected = (id) => () => {
    // Broadcast connected
  }
  private onDisconnected = (id) => () => {
    // Broadcast disconnected
  }
  private onStateChange = (id) => (state: any) => {
    // console.log(this.server)
    this.server.emit('state:change', { id, state });
  }

  public listDevices(): Promise<DeviceEntity[]> {
    return this.deviceRepository.find();
  }

  public getDevice(id: string): Promise<DeviceEntity> {
    return this.deviceRepository.findOne({ id });
  }

  public createDevice(device: DeviceEntity) {
    return this.deviceRepository.insert(device);
  }

  public updateDevice(id: string, changes: Partial<DeviceEntity>) {
    console.error(this.updateDevice, id, changes);
    return this.deviceRepository.update(id, changes);
  }

  public deleteDevice(id: string) {
    return this.deviceRepository.delete(id);
  }

  public getConnection(deviceId: string) {
    return this.deviceConnections.get(deviceId);
  }

  public getConnections() {
    return this.deviceConnections;
  }
}
