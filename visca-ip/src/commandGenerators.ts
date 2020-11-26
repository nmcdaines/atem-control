/*
 * A list of available commands can be found at:
 * https://www.sony.net/Products/CameraSystem/CA/BRC_X1000_BRC_H800/Technical_Document/C456100121.pdf
 */


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

export const EXPOSURE_GAIN_LIMIT = (limit) => [0x80, 0x01, 0x04, 0x2C, limit, EOM];
export const EXPOSURE_GAIN_POINT = (isOn: boolean) => [0x80, 0x01, 0x05, 0x0C, isOn ? 0x02 : 0x03, EOM];
export const EXPOSURE_GAIN_POINT_POSITION = (gainPosition) => [0x80, 0x01, 0x05, 0x4C, gainPosition, EOM];

export const EXPOSURE_SHUTTER = () => [0x80, 0x01, 0x04, 0x0A];
export const EXPOSURE_RESET = () => [...EXPOSURE_SHUTTER(), 0x00, EOM];
export const EXPOSURE_UP = () => [...EXPOSURE_SHUTTER(), 0x02, EOM];
export const EXPOSURE_DOWN = () => [...EXPOSURE_SHUTTER(), 0x03, EOM];
export const EXPOSURE_DIRECT = (shutterPosition) => [0x80, 0x01, 0x04, 0x4A, 0x00, 0x00, shutterPosition, EOM];

export const EXPOSURE_MAX_SHUTTER_DIRECT = (maxShutter) => [0x80, 0x01, 0x05, 0x2A, 0x00, maxShutter, EOM];
export const EXPOSURE_MIN_SHUTTER_DIRECT = (minShutter) => [0x80, 0x01, 0x05, 0x2A, 0x01, minShutter, EOM];

export const EXPOSURE_AE_SPEED_DIRECT = (aeSpeed) => [0x80, 0x01, 0x04, 0x5D, aeSpeed, EOM];


export const FOCUS_AUTO = () => [0x80, 0x01, 0x04, 0x38, 0x02, EOM];
export const FOCUS_MANUAL = () => [0x80, 0x01, 0x04, 0x38, 0x03, EOM];
export const FOCUS_FAR = () => [0x80, 0x01, 0x04, 0x08, 0x02, EOM];
export const FOCUS_NEAR = () => [0x80, 0x01, 0x04, 0x08, 0x03, EOM];
export const FOCUS_DIRECT = (focus) => [0x80, 0x01, 0x04, 0x48, focus, EOM]
