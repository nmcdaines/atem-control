import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway' 
import { SettingsModule } from './settings/settings.module';
import { NetworkModule } from './network/network.module';
import { AtemService } from './atem/atem.service';
import { MacrosModule } from './macros/macros.module';
import { ShortcutsModule } from './shortcuts/shortcuts.module';
import { LivestreamModule } from './livestream/livestream.module';

@Module({
  imports: [SettingsModule, NetworkModule, MacrosModule, ShortcutsModule, LivestreamModule],
  controllers: [AppController],
  providers: [AppService, AppGateway, AtemService],
})
export class AppModule {}
