import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayInit,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Socket, Server } from 'socket.io';
import { ShortcutsService } from './shortcuts.service';
import { Shortcut } from './shortcut.entity'; 

@WebSocketGateway()
export class ShortcutsGateway {
  constructor(
    private readonly shortcutsService: ShortcutsService,
  ) {}


  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ShortcutsGateway')

  @SubscribeMessage('shortcut:create')
  async handleShortcutCreate(client: Socket, payload: any) {
    const shortcut = new Shortcut();
    shortcut.page = payload.page;
    shortcut.slot = payload.slot;
    shortcut.command = payload.command;
    shortcut.value = payload.value;
    
    await this.shortcutsService.createShortcut(shortcut);
    await this.handleShortcutList(client, '');
  }

  @SubscribeMessage('shortcut:update')
  async handleShortcutUpdate(client: Socket, payload: any) {
    const { id, ...changes } = payload;
    const existingShortcut = this.shortcutsService.getShortcut(id);
    await this.shortcutsService.updateShortcut(id, changes);
    await this.handleShortcutList(client, '');
  }

  @SubscribeMessage('shortcut:delete')
  async handleShortcutDelete(client: Socket, payload: any) {
    await this.shortcutsService.deleteShortcut(payload.id);
    await this.handleShortcutList(client, '');
  }

  @SubscribeMessage('shortcut:list')
  async handleShortcutList(client: Socket, payload: any) {
    const shortcuts = await this.shortcutsService.listShortcuts();
    client.emit('response:shortcut:list', shortcuts);
  }
}
