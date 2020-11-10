import { ActionNoop } from "./ActionNoop";
import { ActionSetPiP, EDirection } from "./ActionSetPiP";
import { ActionSetPreview } from "./ActionSetPreview";
import { ActionSetProgram } from "./ActionSetProgram";
import { ActionTransitionAuto } from "./ActionTransitionAuto";
export declare enum ActionType {
    SET_PROGRAM = "SET_PROGRAM",
    SET_PREVIEW = "SET_PREVIEW",
    TRANSITION_AUTO = "TRANSITION_AUTO",
    TRANSITION_CUT = "TRANSITION_CUT",
    SET_PIP = "SET_PIP",
    RECALL_SHORTCUTE = "RECALL_SHORTCUT",
    RECALL_MACRO = "RECALL_MACRO",
    NOOP = "NOOP"
}
export interface IAction<P> {
    type: ActionType;
    properties: P;
}
export declare function objectToAction(type: string, properties: any): IAction<any>;
export { ActionNoop, ActionSetProgram, ActionSetPreview, ActionSetPiP, ActionTransitionAuto, EDirection, };
