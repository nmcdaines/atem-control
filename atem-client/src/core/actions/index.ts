export enum ActionType {
  SET_PROGRAM = "SET_PROGRAM",                  // me, input
  SET_PREVIEW = "SET_PREVIEW",                  // me, input
  TRANSITION_AUTO = "TRANSITION_AUTO",          // me, [optional] source
  TRANSITION_CUT = "TRANSITION_CUT",            // me, [optional] source
  SET_PIP = "SET_PIP",                          // me, enabled, left, top, height, width
}

export interface IAction<P> {
  type: ActionType,
  properties: P;
  getMessage: () => { type: ActionType, properties: P };
}