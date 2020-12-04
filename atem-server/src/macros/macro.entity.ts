import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";
import {IStep} from './step.interface';

@Entity()
export class Macro {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    description: string;

    @Column('jsonb')
    steps: IStep[];

    @Column()
    device: string;

    @Column()
    type: string;
}