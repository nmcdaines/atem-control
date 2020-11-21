import { Module } from '@nestjs/common';
import { AtemService } from './atem.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './device.entity';
import { AtemGateway } from './atem.gateway';

@Module({
    imports: [TypeOrmModule.forFeature([Device])],
    providers: [AtemService, AtemGateway],
    exports: [AtemService],
})
export class AtemModule {}
