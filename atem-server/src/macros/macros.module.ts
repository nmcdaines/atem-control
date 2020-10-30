import { Module } from '@nestjs/common';
import { MacrosGateway } from "./macros.gateway";
import {TypeOrmModule} from "@nestjs/typeorm";
import {Macro} from "./macro.entity";
import { AtemModule } from '../atem/atem.module';

@Module({
    imports: [TypeOrmModule.forFeature([ Macro ]), AtemModule],
    providers: [MacrosGateway],
})
export class MacrosModule {}
