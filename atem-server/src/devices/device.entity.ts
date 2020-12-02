import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ipAddress: string;

    @Column()
    name: string;

    @Column()
    type: 'atem' | 'birddog';
}