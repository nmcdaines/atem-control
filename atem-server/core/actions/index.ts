import { IAction } from "atem-lib";
import { Atem } from "atem-connection";

import { ActionNoop } from "./ActionNoop";
import { ActionSetPiP, EDirection } from "./ActionSetPiP";
import { ActionSetPreview } from "./ActionSetPreview";
import { ActionSetProgram } from "./ActionSetProgram";
import { ActionTransitionAuto } from "./ActionTransitionAuto";

export enum ActionType {
  SET_PROGRAM = "SET_PROGRAM",                  // me, input
  SET_PREVIEW = "SET_PREVIEW",                  // me, input
  TRANSITION_AUTO = "TRANSITION_AUTO",          // me, [optional] source
  TRANSITION_CUT = "TRANSITION_CUT",            // me, [optional] source
  SET_PIP = "SET_PIP",                          // me, enabled, left, top, height, width

  RECALL_SHORTCUTE = "RECALL_SHORTCUT",
  RECALL_MACRO = "RECALL_MACRO",

  NOOP = "NOOP",
}

export interface IServerAction<P> extends IAction<P>{
  type: ActionType;
  properties: P;
  execute: (atem: Atem) => Promise<void | undefined>;
}

// TODO: Implement a Noop action
export function objectToAction(type: string, properties: any): IAction<any> {
  // FoundAction is either an IAction or empty
  const FoundAction = {
    [ActionType.SET_PROGRAM]: ActionSetProgram,
    [ActionType.SET_PREVIEW]: ActionSetProgram,
  }[type];

  return FoundAction
    ? new FoundAction(properties)
    : new ActionNoop();
}


export {
  ActionNoop,
  ActionSetProgram,
  ActionSetPreview,
  ActionSetPiP,
  ActionTransitionAuto,
  EDirection,
}
