import React, {useEffect, useState} from 'react';
import AppBar from './components/AppBar';
import io from 'socket.io-client';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  // Link
} from "react-router-dom";

import SurfaceContainer from "./containers/Surface";
import SettingsContainer from "./containers/Settings";
import ShortcutsContainer from "./containers/Shortcuts";
import LivestreamContainer from "./containers/Livestream";

import { SocketProvider } from "./core/SocketContext"

// const socket = io('ws://localhost:3000', { });



function App() {
  const [atemState, setAtemState] = useState<any>();
  const [messageType, setMessageType] = useState('');
  const [messageBody, setMessageBody] = useState('{}');

  // useEffect(() => {
  //   socket.on('state:change', (val: any) => {
  //     console.log(val);
  //     setAtemState(val);
  //   });
  // });

  return (
    <div className="App">

        <Router>
          <AppBar />

          <Switch>
            <Route path="/shortcuts" component={ShortcutsContainer} />
            <Route path="/surface" component={SurfaceContainer} />
            <Route path="/settings" component={SettingsContainer} />
            <Route path="/livestream" component={LivestreamContainer} />
          </Switch>
        </Router>


      {/*<code style={{ paddingTop: '100px' }}>*/}
      {/*  { JSON.stringify(atemState) }*/}
      {/*</code>*/}

      <div>
      <input
        value={messageType}
        onChange={(e) => setMessageType(e.target.value)}
        placeholder="Message Type"
      />

      <textarea
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        placeholder="Message Body"
      />

        <button
          onClick={() => {
            console.log('connect message');
            // socket.emit(messageType, JSON.parse(messageBody));
          }}
        >
            Send
        </button>
      </div>


        <button onClick={() => {
            console.log('connect message');
            // socket.emit('atem:connect', 'this is the args');
        }}>
            Connect
        </button>

          <button onClick={() => {
              console.log('sending message');
              // socket.emit('macro:run', 'hello world')
          }}>
              Send message
          </button>



    </div>
  );
}

export default App;
