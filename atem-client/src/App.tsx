import React from 'react';
import logo from './logo.svg';
import './App.css';

import SettingsNavigation from './components/SettingsNavigation';

import AppBar from './components/AppBar';

import io from 'socket.io-client';

import {
  BrowserRouter as Router,
  Switch,
  Route,
  // Link
} from "react-router-dom";

const socket = io('ws://localhost:3000', { });

function App() {
  return (
    <div className="App">
      <Router>
        <AppBar />

        <Switch>
          <Route path="/settings">
            <SettingsNavigation />
          </Route>
        </Switch>



      </Router>




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
