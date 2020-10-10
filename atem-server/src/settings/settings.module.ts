import { Module } from '@nestjs/common';
import { SettingsGateway } from './settings.gateway';

@Module({
  imports: [],
  controllers: [],
  providers: [SettingsGateway],
})
export class SettingsModule {}
