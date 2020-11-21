import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import {IAction} from "./actions";

const SocketStateContext = React.createContext<any>(undefined);
const SocketDispatchContext = React.createContext<any>(undefined);
const AtemStateContext = React.createContext<any>({});

const socket = io('ws://localhost:3000', {});

const initialState: any = {
  devices: [
    { id: '', ipAddress: '', name: '' },
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
  const [devices, setDevices] = useState<Record<string, any>>({});

  const [state, dispatch] = React.useReducer<any>(reducerFn, initialState);

  useEffect(() => {
    socket.on('state:change', (payload: any) => {
      console.log('change', payload);

      setDevices({
        ...devices,
        [payload.id]: payload.state,
      })
    });

    // return () => {
    //   socket.close();
    // }
  });

  return (
    <SocketStateContext.Provider value={state}>
      <SocketDispatchContext.Provider value={dispatch}>
        <AtemStateContext.Provider value={devices}>
          { children }
        </AtemStateContext.Provider>
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

function useAtemState() {
  const context = React.useContext(AtemStateContext);
  if (context === undefined) {
    throw new Error('useAtemState must be used within a SocketProvider');
  }
  return context;
}

export { SocketProvider, useSocketState, useAtemState }
