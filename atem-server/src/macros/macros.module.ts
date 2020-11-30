import { Module } from '@nestjs/common';
import { MacrosGateway } from "./macros.gateway";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Macro} from "./macro.entity";
import { AtemModule } from '../atem/atem.module';
import { MacrosService } from './macros.service';
import { ActionsModule } from 'src/actions/actions.module';

@Module({
    imports: [TypeOrmModule.forFeature([ Macro ]), AtemModule, ActionsModule],
    providers: [MacrosGateway, MacrosService],
})
export class MacrosModule {}
