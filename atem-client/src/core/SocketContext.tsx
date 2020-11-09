import React from "react";
import io from "socket.io-client";
import {IAction} from "./actions";

const SocketStateContext = React.createContext<any>(undefined);
const SocketDispatchContext = React.createContext<any>(undefined);

const socket = io('ws://localhost:3000', {});

const initialState: any = {
  devices: [
    { ip: '192.168.1.35', mac: '', name: 'ATEM Mini' },
    { ip: '192.168.1.36', mac: '', name: 'ATEM Mini 2' },
  ],
  discovery: [
    { ip: '192.168.0.200', mac: 'xxxxxx' },
    { ip: '192.168.0.201', mac: 'xxxxxx' },
    { ip: '192.168.0.202', mac: 'xxxxxx' },
  ],
}

function reducerFn(state: any, action: any) {

  return { ...initialState };
}

function executeAction(action: IAction<any>) {
  action.getMessage();
}

function SocketProvider({ children }: any) {
  const [state, dispatch] = React.useReducer<any>(reducerFn, initialState);

  return (
    <SocketStateContext.Provider value={state}>
      <SocketDispatchContext.Provider value={dispatch}>
        { children }
      </SocketDispatchContext.Provider>
    </SocketStateContext.Provider>
  );
}

function useSocketState() {
  const context = React.useContext(SocketStateContext);
  if (context === undefined) {
    throw new Error('useSocketState must be used within a SocketProvider');
  }
  return context;
}


export { SocketProvider, useSocketState }
