declare enum ActionType {
    SET_PROGRAM = "SET_PROGRAM",
    SET_PREVIEW = "SET_PREVIEW",
    TRANSITION_AUTO = "TRANSITION_AUTO",
    TRANSITION_CUT = "TRANSITION_CUT",
    SET_PIP = "SET_PIP",
    RECALL_SHORTCUT = "RECALL_SHORTCUT",
    RECALL_MACRO = "RECALL_MACRO",
    NOOP = "NOOP",
    SET_LIVESTREAM = "SET_LIVESTREAM",
    LIVESTREAM_START = "LIVESTREAM_START",
    LIVESTREAM_STOP = "LIVESTREAM_STOP",
    SET_INPUT_NAME = "SET_INPUT_NAME",
    VISCA_SET_PAN_TILT = "VISCA_SET_PAN_TILT",
    VISCA_SET_ZOOM = "VISCA_SET_ZOOM"
}
interface IAction<P> {
    type: ActionType;
    properties: P;
}
interface IClientAction<P> extends IAction<P> {
    getMessage: () => {
        type: ActionType;
        properties: P;
    };
}
interface ISetInputNameProperties {
    input: number;
    longName: string;
    shortName: string;
}
interface ISetPiPProperties {
    positionX: number;
    positionY: number;
    sizeX: number;
    sizeY: number;
    direction: EDirection;
    source: number;
}
interface ISetPreviewProperties {
    input: number;
}
interface ISetProgramProperties {
    input: number;
}
interface ITransitionAutoProperties {
    input?: number;
}
interface ITransitionCutProperties {
    input?: number;
}
interface IViscaSetPanTiltProperties {
    pan: number;
    tilt: number;
}
interface IViscaSetZoom {
    zoom: number;
}
declare enum EDirection {
    ON = "ON",
    OFF = "OFF"
}
export { ActionType, IAction, IClientAction, ISetPiPProperties, ISetPreviewProperties, ISetProgramProperties, ITransitionAutoProperties, ITransitionCutProperties, ISetInputNameProperties, EDirection, IViscaSetPanTiltProperties, IViscaSetZoom, };
