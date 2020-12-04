import React, { useState, useEffect } from "react";
import io  from "socket.io-client";
import {IAction} from "./actions";

const SocketStateContext = React.createContext<any>(undefined);
const SocketDispatchContext = React.createContext<any>(undefined);
const AtemStateContext = React.createContext<any>({});
const DevicesContext = React.createContext<any>({});
const SocketContext = React.createContext<SocketIOClient.Socket | undefined>(undefined);
const MacrosContext = React.createContext<any>({});

const ENDPOINT = `ws://${window.location.hostname}:3000`;

let socket: SocketIOClient.Socket;

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
  const [deviceStates, setDeviceStates] = useState<Record<string, any>>({});
  const [state, dispatch] = React.useReducer<any>(reducerFn, initialState);
  const [macros,setMacros] = useState<Record<string, any>>({});

  useEffect(() => {
    socket = io(ENDPOINT);

    socket.on('connect', () => {
      console.log('socket -> connected');

      // SOCKET INITIALISED
      socket.emit('device:list');
      socket.emit('device:state:initial');
      socket.emit('macro:list');
    });

    socket.on('response:device:state:initial', (payload: any) => {
      console.log('socket -> state:initial', payload)
      setDeviceStates(payload);
    });

    socket.on('state:change', (payload: any) => {
      console.log('socket -> state:change', payload);

      setDeviceStates({
        ...deviceStates,
        [payload.id]: payload.state,
      })
    });

    socket.on('response:device:list', (payload: any) => {
      console.log('socket -> response:device:list', payload);
      setDevices(
        payload.reduce((acc: any, val: any) => {
          return {
            ...acc,
            [val.id]: { ...val }
          }
        }, {})  
      );      
    });

    socket.on('response:macro:list', (payload: any) => {
      console.log('socket -> response:macro:list', payload);

      setMacros(
        payload.reduce((acc: any, val: any) => {
          return {
            ...acc,
            [val.id]: { ...val }
          }
        }, {})  
      );
    });

    return () => {
      socket.close();
    }
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      <SocketStateContext.Provider value={state}>
        <SocketDispatchContext.Provider value={dispatch}>
          <AtemStateContext.Provider value={deviceStates}>
            <DevicesContext.Provider value={devices}>
              <MacrosContext.Provider value={macros}>
                { children }
              </MacrosContext.Provider>
            </DevicesContext.Provider>
          </AtemStateContext.Provider>
        </SocketDispatchContext.Provider>
      </SocketStateContext.Provider>
    </SocketContext.Provider>
  );
}

function useSocketState() {
  const context = React.useContext(SocketStateContext);
  if (context === undefined) {
    throw new Error('useSocketState must be used within a SocketProvider');
  }
  return context;
}

function useSocket() {
  const context = React.useContext(SocketContext);
  return context;
}

function useAtemState() {
  const context = React.useContext(AtemStateContext);
  if (context === undefined) {
    throw new Error('useAtemState must be used within a SocketProvider');
  }
  return context;
}

function useDevices() {
  const context = React.useContext(DevicesContext);
  if (context === undefined) {
    throw new Error('useDevices must be used within a SocketProvider');
  }
  return context;
}

function useMacros() {
  const context = React.useContext(MacrosContext);
  if (context === undefined) {
    throw new Error('useMacros must be used within a SocketProvider');
  }
  return context;
}

export { SocketProvider, useSocket, useSocketState, useAtemState, useDevices, useMacros }
