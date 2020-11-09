import { ActionType, IAction } from './index';
export declare enum EDirection {
    ON = "ON",
    OFF = "OFF"
}
export interface ISetPiPProperties {
    positionX: number;
    positionY: number;
    scaleX: number;
    scaleY: number;
    direction: EDirection;
}
export declare class ActionSetPiP implements IAction<ISetPiPProperties> {
    type: ActionType;
    properties: ISetPiPProperties;
    constructor(props: ISetPiPProperties);
    getMessage: () => {
        type: ActionType;
        properties: ISetPiPProperties;
    };
}
