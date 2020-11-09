import { ActionType, IAction } from './index';
export interface ISetPreviewProperties {
    input: string;
}
export declare class ActionSetPreview implements IAction<ISetPreviewProperties> {
    type: ActionType;
    properties: ISetPreviewProperties;
    constructor(props: ISetPreviewProperties);
    getMessage: () => {
        type: ActionType;
        properties: ISetPreviewProperties;
    };
}
