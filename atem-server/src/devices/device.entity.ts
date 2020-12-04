import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Device {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    ipAddress: string;

    @Column()
    name: string;

    @Column({ nullable: true, type: "character varying" })
    type: string;
}