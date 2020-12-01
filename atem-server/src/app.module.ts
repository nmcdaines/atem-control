import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway' 
import { SettingsModule } from './settings/settings.module';
import { NetworkModule } from './network/network.module';
// import { AtemService } from './atem/atem.service';
import { AtemModule } from "./atem/atem.module";
import { MacrosModule } from './macros/macros.module';
import { ShortcutsModule } from './shortcuts/shortcuts.module';
import { LivestreamModule } from './livestream/livestream.module';
import { DatabaseModule } from './database/database.module';
import { ActionsModule } from './actions/actions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DevicesModule } from './devices/devices.module';


@Module({
  imports: [
      ConfigModule.forRoot(),
      ScheduleModule.forRoot(),

      DatabaseModule,
      AtemModule,
      // SettingsModule,
      NetworkModule,
      MacrosModule,
      // ShortcutsModule,
      // LivestreamModule,
      ActionsModule,
      DevicesModule
  ],
  controllers: [AppController],
  providers: [AppService, AppGateway],
})
export class AppModule {}
