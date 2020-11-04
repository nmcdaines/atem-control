import React from 'react';
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

const socket = io('ws://localhost:3000', { });

function App() {
  return (
    <div className="App">
      <SocketProvider>
        <Router>
          <AppBar />

          <Switch>
            <Route path="/shortcuts" component={ShortcutsContainer} />
            <Route path="/surface" component={SurfaceContainer} />
            <Route path="/settings" component={SettingsContainer} />
            <Route path="/livestream" component={LivestreamContainer} />
          </Switch>
        </Router>
      </SocketProvider>




        <button onClick={() => {
            console.log('connect message');
            socket.emit('atem:connect', 'this is the args');
        }}>
            Connect
        </button>

          <button onClick={() => {
              console.log('sending message');
              socket.emit('macro:run', 'hello world')
          }}>
              Send message
          </button>



    </div>
  );
}

export default App;
