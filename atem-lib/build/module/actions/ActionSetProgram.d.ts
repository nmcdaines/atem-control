import { ActionType, IAction } from './index';
export interface ISetProgramProperties {
    input: string;
}
export declare class ActionSetProgram implements IAction<ISetProgramProperties> {
    type: ActionType;
    properties: ISetProgramProperties;
    constructor(props: ISetProgramProperties);
    getMessage: () => {
        type: ActionType;
        properties: ISetProgramProperties;
    };
}
