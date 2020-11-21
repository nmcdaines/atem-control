import { ActionSetProgram } from './ActionSetProgram';
import { ActionSetPreview } from './ActionSetPreview';
import { ActionSetPiP, EDirection } from './ActionSetPiP';
import { ActionTransitionAuto } from './ActionTransitionAuto';

export enum ActionType {
  SET_PROGRAM = "SET_PROGRAM",                  // me, input
  SET_PREVIEW = "SET_PREVIEW",                  // me, input
  TRANSITION_AUTO = "TRANSITION_AUTO",          // me, [optional] source
  TRANSITION_CUT = "TRANSITION_CUT",            // me, [optional] source
  SET_PIP = "SET_PIP",                          // me, enabled, left, top, height, width

  RECALL_SHORTCUT = "RECALL_SHORTCUT",
  RECALL_MACRO = "RECALL_MACRO",
}

export interface IAction<P> {
  type: ActionType,
  properties: P;
  getMessage: () => { type: ActionType, properties: P };
}

export {
  ActionSetProgram,
  ActionSetPreview,
  ActionSetPiP,
  EDirection,
}
