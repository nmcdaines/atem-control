import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";
import {IStep} from './step.interface';

@Entity()
export class Macro {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column('jsonb')
    steps: IStep[];
}