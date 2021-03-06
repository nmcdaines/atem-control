import { ActionNoop } from "./ActionNoop";
import { ActionAtemSetPiP, EDirection } from "./ActionAtemSetPiP";
import { ActionAtemSetPreview } from "./ActionAtemSetPreview";
import { ActionAtemSetProgram } from "./ActionAtemSetProgram";
import { ActionAtemTransitionAuto } from "./ActionAtemTransitionAuto";
import { ActionAtemSetInputName } from './ActionAtemSetInputName';
import { Device } from '../devices';
import { ActionAtemTransitionCut } from "./ActionAtemTypescriptCut";

import { ActionAtemBirddogPanTilt } from './ActionBirddogPanTilt';
import { ActionAtemBirddogZoom } from './ActionBirddogZoom';

enum ActionType {
  SET_PROGRAM = "SET_PROGRAM",                  // me, input
  SET_PREVIEW = "SET_PREVIEW",                  // me, input
  TRANSITION_AUTO = "TRANSITION_AUTO",          // me, [optional] source
  TRANSITION_CUT = "TRANSITION_CUT",            // me, [optional] source
  SET_PIP = "SET_PIP",                          // me, enabled, left, top, height, width

  RECALL_SHORTCUT = "RECALL_SHORTCUT",
  RECALL_MACRO = "RECALL_MACRO",

  NOOP = "NOOP",

  SET_LIVESTREAM = "SET_LIVESTREAM",
  LIVESTREAM_START = "LIVESTREAM_START",
  LIVESTREAM_STOP = "LIVESTREAM_STOP",

  SET_INPUT_NAME = "SET_INPUT_NAME",


  VISCA_SET_PAN_TILT = "VISCA_SET_PAN_TILT",    // pan, tilt
  VISCA_SET_ZOOM = "VISCA_SET_ZOOM",            // zoom
}

interface IAction<P> {
  type: ActionType;
  properties: P;
}

export interface IServerAction<P> extends IAction<P>{
  type: ActionType;
  properties: P;
  execute: (device: Device) => Promise<void | undefined>;
}

// TODO: Implement a Noop action
export function objectToAction(type: string, properties: any): IServerAction<any> {
  const FoundAction = {
    [ActionType.SET_PROGRAM]: ActionAtemSetProgram,
    [ActionType.SET_PREVIEW]: ActionAtemSetPreview,
    [ActionType.SET_PIP]: ActionAtemSetPiP,

    [ActionType.TRANSITION_AUTO]: ActionAtemTransitionAuto,
    [ActionType.TRANSITION_CUT]: ActionAtemTransitionCut,

    [ActionType.SET_INPUT_NAME]: ActionAtemSetInputName,

    [ActionType.RECALL_SHORTCUT]: ActionNoop,
    [ActionType.RECALL_MACRO]: ActionNoop,    

    [ActionType.VISCA_SET_PAN_TILT]: ActionAtemBirddogPanTilt,
    [ActionType.VISCA_SET_ZOOM]: ActionAtemBirddogZoom,
  }[type];

  return FoundAction
    ? new FoundAction(properties)
    : new ActionNoop();
}

export {
  ActionNoop,
  ActionAtemSetProgram,
  ActionAtemSetPreview,
  ActionAtemSetPiP,
  ActionAtemTransitionAuto,
  ActionAtemTransitionCut,
  ActionAtemSetInputName,
  EDirection,

  ActionType,
  IAction
}
