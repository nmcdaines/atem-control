import { Module } from '@nestjs/common';
import { ShortcutsService } from './shortcuts.service';
import { ShortcutsGateway } from './shortcuts.gateway';

@Module({
  providers: [ShortcutsService, ShortcutsGateway]
})
export class ShortcutsModule {}
