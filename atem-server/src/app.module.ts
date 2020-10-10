import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [SettingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
