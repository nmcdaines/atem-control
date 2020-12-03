import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway' 
import { MacrosModule } from './macros/macros.module';
import { ShortcutsModule } from './shortcuts/shortcuts.module';
import { LivestreamModule } from './livestream/livestream.module';
import { DatabaseModule } from './database/database.module';
import { ActionsModule } from './actions/actions.module';
import { DevicesModule } from './devices/devices.module';




@Module({
  imports: [
      ConfigModule.forRoot(),
      ScheduleModule.forRoot(),

      DatabaseModule,

      DevicesModule,
      MacrosModule,
      ShortcutsModule,
      // LivestreamModule,
      ActionsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppGateway],
})
export class AppModule {}
