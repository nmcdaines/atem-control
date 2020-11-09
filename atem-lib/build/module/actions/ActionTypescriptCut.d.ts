import { ActionType, IAction } from './index';
export interface ITransitionCutProperties {
    input?: string;
}
export declare class ActionTransitionCut implements IAction<ITransitionCutProperties> {
    type: ActionType;
    properties: ITransitionCutProperties;
    constructor(props: ITransitionCutProperties);
    getMessage: () => {
        type: ActionType;
        properties: ITransitionCutProperties;
    };
}
