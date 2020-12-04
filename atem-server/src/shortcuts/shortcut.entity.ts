import {Entity, Column, PrimaryGeneratedColumn} from "typeorm";

@Entity()
export class Shortcut {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // Page that the item exists on
    @Column()
    page: number;

    // The Slot that it fits in
    @Column()
    slot: number;

    // What to do
    @Column()
    command: string;

    // Do it with
    @Column()
    value: string;
}