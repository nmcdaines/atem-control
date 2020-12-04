import React from 'react';

import { useSocket, useAtemState } from 'core/SocketContext';

import { Button } from '@material-ui/core';

interface ICameraControlSimple {
  deviceId: string;
  pan?: number;
  tilt?: number;
  zoom?: number;
}

function CameraControlSimple({ deviceId, pan, tilt, zoom }: ICameraControlSimple) {
  const socket = useSocket(); 
  const state = useAtemState()[deviceId];

  console.log(state);

  function moveLeft() {
    socket?.emit('action:execute', {
      id: deviceId,
      type: 'VISCA_SET_PAN_TILT',
      properties: {
        pan: (state.pan || 0) - 10,
        panSpeed: 24,
        tilt: (state.tilt || 0),
        tiltSpeed: 24,
      }
    })
  }

  function moveHome() {
    socket?.emit('action:execute', {
      id: deviceId,
      type: 'VISCA_SET_PAN_TILT',
      properties: {
        pan: 0,
        panSpeed: 24,
        tilt: 0,
        tiltSpeed: 24,
      }
    })
  }

  function moveRight() {
    socket?.emit('action:execute', {
      id: deviceId,
      type: 'VISCA_SET_PAN_TILT',
      properties: {
        pan: (state.pan || 0) + 10,
        panSpeed: 24,
        tilt: (state.tilt || 0),
        tiltSpeed: 24,
      }
    })
  }

  function handleZoom() {
    socket?.emit('action:execute', {
      id: deviceId,
      type: 'VISCA_SET_ZOOM',
      properties: {
        // max: 16384
        zoom: 16934
      }
    })
  }

  return (
    <div>
      <Button variant="outlined" onClick={moveLeft}>Left</Button>
      <Button variant="outlined" onClick={moveHome}>Home</Button>
      <Button variant="outlined" onClick={moveRight}>Right</Button>
      
      <Button variant="outlined" onClick={handleZoom}>Zoom</Button>
    </div>
  )
}

export default CameraControlSimple;
