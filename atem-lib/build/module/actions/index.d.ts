declare enum ActionType {
    SET_PROGRAM = "SET_PROGRAM",
    SET_PREVIEW = "SET_PREVIEW",
    TRANSITION_AUTO = "TRANSITION_AUTO",
    TRANSITION_CUT = "TRANSITION_CUT",
    SET_PIP = "SET_PIP",
    RECALL_SHORTCUT = "RECALL_SHORTCUT",
    RECALL_MACRO = "RECALL_MACRO",
    NOOP = "NOOP"
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
declare enum EDirection {
    ON = "ON",
    OFF = "OFF"
}
export { ActionType, IAction, IClientAction, ISetPiPProperties, ISetPreviewProperties, ISetProgramProperties, ITransitionAutoProperties, ITransitionCutProperties, EDirection, };
