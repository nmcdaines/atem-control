
// Example Command:
// [SendPacketType.CMD, CommandType.CAM,

export enum SendPacketType {
    CMD = 0x8101,
    INQ = 0x8109,
}

export enum CommandType {
    CAM = 0x04,
    PAN_TILT = 0x06,
}

export enum Command {
    EXPOSURE_MODE_FULLAUTO =
}

const commands = () => {

}

export enum PanTiltDirection {

}


export enum PresetOperation {

}

export enum ConnectionState {
    Closed,
    Connecting,
    Connected
}

export enum ShutterDirect {
    F1_30 = 0x0001,
    F1_60 = 0x0002,
    F1_90 = 0x0003,
    F1_100 = 0x0004,
    F1_125 = 0x0005,
    F1_180 = 0x0006,
    F1_250 = 0x0007,
    F1_350 = 0x0008,
    F1_500 = 0x0009,
    F1_725 = 0x000A,
    F1_1000 = 0x000B,
    F1_1500 = 0x000C,
    F1_2000 = 0x000D,
    F1_3000 = 0x000E,
    F1_4000 = 0x000F,
    F1_6000 = 0x0100,
    F1_10000 = 0x0101
}

export enum IrisDirect {
    Close = 0x0000,
    F11 = 0x0006,
    F9_6 = 0x0007,
    F8_0 = 0x0008,
    F6_8 = 0x0009,
    F5_6 = 0x000A,
    F4_8 = 0x000B,
    F4_0 = 0x000C,
    F3_4 = 0x000D,
    F2_4 = 0x000F,
    F2_0 = 0x0100,
    F1_8 = 0x0200
}

export enum GainDirect {
    G_0 = 0x0000,
    G_1 = 0x0001,
    G_2 = 0x0002,
    G_3 = 0x0003,
    G_4 = 0x0004,
    G_5 = 0x0005,
    G_6 = 0x0006,
    G_7 = 0x0008          // This sounds a little strange
}

export enum ExpCompDirect {
    N_7 = 0x0000,
    N_6 = 0x0001,
    N_5 = 0x0002,
    N_4 = 0x0003,
    N_3 = 0x0004,
    N_2 = 0x0005,
    N_1 = 0x0006,
    P_0 = 0x0007,
    P_1 = 0x0008,
    P_2 = 0x0009,
    P_3 = 0x000A,
    P_4 = 0x000B,
    P_5 = 0x000C,
    P_6 = 0x000D,
    P_7 = 0x000E
}
