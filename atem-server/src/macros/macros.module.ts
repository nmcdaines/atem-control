import { Module } from '@nestjs/common';
import { MacrosGateway } from "./macros.gateway";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Macro} from "./macro.entity";
import { MacrosService } from './macros.service';
import { ActionsModule } from 'src/actions/actions.module';
import { DevicesModule } from 'src/devices/devices.module';

@Module({
    imports: [TypeOrmModule.forFeature([ Macro ]), DevicesModule, ActionsModule],
    providers: [MacrosGateway, MacrosService],
})
export class MacrosModule {}
