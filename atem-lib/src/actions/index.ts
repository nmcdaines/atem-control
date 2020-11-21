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

  SET_INPUT_NAME = "NAME",
}

interface IAction<P> {
  type: ActionType;
  properties: P;
}

interface IClientAction<P> extends IAction<P> {
  getMessage: () => { type: ActionType, properties: P };
}

interface ISetInputNameProperties {
  input: number;
  longName: string;
  shortName: string;
}

interface ISetPiPProperties {
  positionX: number;
  positionY: number;
  sizeX: number;
  sizeY: number;
  direction: EDirection;
  source: number;
}

interface ISetPreviewProperties {
  input: number;
}

interface ISetProgramProperties {
  input: number;
}

interface ITransitionAutoProperties {
  input?: number;
}

interface ITransitionCutProperties {
  input?: number;
}

enum EDirection {
  ON = "ON",
  OFF = "OFF"
}

export {
  ActionType,
  IAction,
  IClientAction,
  ISetPiPProperties,
  ISetPreviewProperties,
  ISetProgramProperties,
  ITransitionAutoProperties,
  ITransitionCutProperties,
  ISetInputNameProperties,
  EDirection,
}
