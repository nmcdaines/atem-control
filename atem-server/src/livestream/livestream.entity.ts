import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Livestream {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column()
    key: string;
}