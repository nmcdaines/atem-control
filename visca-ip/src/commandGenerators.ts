const EOM = 0xFF;


const EXPOSURE_MODE = () => [0x80, 0x01, 0x04, 0x39];
export const EXPOSURE_MODE_FULLAUTO =           () => [...EXPOSURE_MODE(), 0x00, EOM];
export const EXPOSURE_MODE_MANUAL =             () => [...EXPOSURE_MODE(), 0x03, EOM];
export const EXPOSURE_MODE_SHUTTER_PRIORITY =   () => [...EXPOSURE_MODE(), 0x0A, EOM];
export const EXPOSURE_MODE_IRIS_PRIORITY =      () => [...EXPOSURE_MODE(), 0x0B, EOM];
export const EXPOSURE_MODE_GAIN_PRIORITY =      () => [...EXPOSURE_MODE(), 0x0E, EOM];


const EXPOSURE_IRIS = () => [0x80, 0x01, 0x04, 0x0B];
export const EXPOSURE_IRIS_RESET =              () => [...EXPOSURE_IRIS(), 0x00, EOM];
export const EXPOSURE_IRIS_UP =                 () => [...EXPOSURE_IRIS(), 0x02, EOM];
export const EXPOSURE_IRIS_DOWN =               () => [...EXPOSURE_IRIS(), 0x03, EOM];
export const EXPOSURE_IRIS_DIRECT =             (irisPosition: any) => [...EXPOSURE_IRIS(), 0x00, irisPosition, EOM];


const EXPOSURE_GAIN = () => [0x80, 0x01, 0x04, 0x0C];
export const EXPOSURE_GAIN_RESET =              () => [...EXPOSURE_GAIN(), 0x00, EOM];
export const EXPOSURE_GAIN_UP =                 () => [...EXPOSURE_GAIN(), 0x02, EOM];
export const EXPOSURE_GAIN_DOWN =               () => [...EXPOSURE_GAIN(), 0x03, EOM];
export const EXPOSURE_GAIN_DIRECT =             (irisPosition: any) => [...EXPOSURE_GAIN(), 0x00, irisPosition, EOM];
