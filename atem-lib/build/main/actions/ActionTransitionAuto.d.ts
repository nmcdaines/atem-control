import { ActionType, IAction } from './index';
export interface ITransitionAutoProperties {
    input?: string;
}
export declare class ActionTransitionAuto implements IAction<ITransitionAutoProperties> {
    type: ActionType;
    properties: ITransitionAutoProperties;
    constructor(props: ITransitionAutoProperties);
    getMessage: () => {
        type: ActionType;
        properties: ITransitionAutoProperties;
    };
}
