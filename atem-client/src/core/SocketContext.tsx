import React from "react";

const SocketStateContext = React.createContext<any>(undefined);
const SocketDispatchContext = React.createContext<any>(undefined);

const initialState: any = {
  devices: [{

  }],
  discovery: [
    { ip: '192.168.0.200', mac: 'xxxxxx' },
    { ip: '192.168.0.201', mac: 'xxxxxx' },
    { ip: '192.168.0.202', mac: 'xxxxxx' },
  ],
}

function reducerFn(state: any, action: any) {

  return { ...initialState };
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
