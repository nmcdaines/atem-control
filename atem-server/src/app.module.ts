import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway' 
import { SettingsModule } from './settings/settings.module';
import { NetworkModule } from './network/network.module';
import { AtemService } from './atem/atem.service';

@Module({
  imports: [SettingsModule, NetworkModule],
  controllers: [AppController],
  providers: [AppService, AppGateway, AtemService],
})
export class AppModule {}
