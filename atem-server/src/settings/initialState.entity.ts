import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class InitialState {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    deviceId: string;

    @Column()
    command: string;

    @Column()
    value: string;

    @Column()
    order: number;

    @Column()
    delay: number;
}