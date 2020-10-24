import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Shortcut {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    page: number;

    @Column()
    slot: number;

    @Column()
    command: string;

    @Column()
    value: string;
}