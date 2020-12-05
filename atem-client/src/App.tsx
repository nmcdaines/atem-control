import React, {useEffect, useState} from 'react';
import AppBar from './components/AppBar';
import { TextField, Button, Box, Container, Paper } from "@material-ui/core";
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
import CameraContainer from "./containers/Camera";

import { SocketProvider, useSocket } from "./core/SocketContext";

import CameraControl from './components/CameraControl';

function App() {
  const [atemState, setAtemState] = useState<any>();
  const [messageType, setMessageType] = useState('');
  const [messageBody, setMessageBody] = useState('{}');

  const socket = useSocket();

  return (
    <div className="App">
        <Router>
          <AppBar />

          <Switch>
            <Route path="/shortcuts" component={ShortcutsContainer} />
            <Route path="/surface" component={SurfaceContainer} />
            <Route path="/settings" component={SettingsContainer} />
            <Route path="/livestream" component={LivestreamContainer} />
            <Route path="/camera" component={CameraContainer} />
          </Switch>
        </Router>


      <div>


        <Container style={{ marginTop: 20 }}>
          <Paper>
            <Box p={2}>

      <Box>
            <TextField
        variant="outlined"
        fullWidth
        value={messageType}
        onChange={(e) => setMessageType(e.target.value)}
        placeholder="Message Type"
        label="Type"
      />
      </Box>
      <Box mt={2}>
        <TextField
        variant="outlined"
        fullWidth
        multiline
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        placeholder="Body"
        label="Body"
      />
      </Box>
              <Box mt={2}>
                <Button
          variant="contained"
          color="primary"
          onClick={() => {
            console.log('connect message');
            socket?.emit(messageType, JSON.parse(messageBody));
          }}
        >
            Send
        </Button>
              </Box>
            </Box>
          </Paper>
        </Container>

      </div>
    </div>
  );
}

export default App;
