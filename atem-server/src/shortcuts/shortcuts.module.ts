import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortcutsService } from './shortcuts.service';
import { ShortcutsGateway } from './shortcuts.gateway';
import { Shortcut } from './shortcut.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Shortcut])],
  providers: [ShortcutsService, ShortcutsGateway]
})
export class ShortcutsModule {}
