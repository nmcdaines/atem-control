import { ActionType, IAction } from './index';
export declare class ActionNoop implements IAction<undefined> {
    type: ActionType;
    properties: undefined;
    constructor();
    getMessage: () => {
        type: ActionType;
        properties: any;
    };
}
