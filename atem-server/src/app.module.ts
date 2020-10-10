import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppGateway } from './app.gateway' 
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [AppController],
  providers: [AppService, AppGateway],
})
export class AppModule {}
