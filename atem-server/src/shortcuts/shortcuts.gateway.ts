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
    
    this.shortcutsService.createShortcut(shortcut);
  }

  @SubscribeMessage('shortcut:update')
  async handleShortcutUpdate(client: Socket, payload: any) {
    const { id, ...changes } = payload;
    const existingShortcut = this.shortcutsService.getShortcut(id);
    this.shortcutsService.updateShortcut(id, changes);
  }

  @SubscribeMessage('shortcut:delete')
  async handleShortcutDelete(client: Socket, payload: any) {
    this.shortcutsService.deleteShortcut(payload.id);
  }

  @SubscribeMessage('shortcut:list')
  async handleShortcutList(client: Socket, payload: any) {
    const shortcuts = await this.shortcutsService.listShortcuts();
    client.emit('response:shortcut:list', shortcuts);
  }

}
