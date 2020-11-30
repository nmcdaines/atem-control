import React, { useState } from "react";
import { Button, Container, TextField } from '@material-ui/core';

import CameraControl from 'components/CameraControl';
import { SocketProvider, useSocket } from "core/SocketContext";

function Camera() {
  const [pan, setPan] = useState<number>(0);
  const [tilt, setTilt] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(0);

  const socket = useSocket();

  function moveSlow() {
    socket?.emit('camera:pantilt', {
      panSpeed: 1,
      tiltSpeed: 1,
      panPosition: pan,
      tiltPosition: tilt,
    });

    socket?.emit('camera:zoom', {
      position: zoom,
    });
  }

  function moveMedium() {
    socket?.emit('camera:pantilt', {
      panSpeed: 8,
      tiltSpeed: 8,
      panPosition: pan,
      tiltPosition: tilt,
    });

    socket?.emit('camera:zoom', {
      position: zoom,
    });
  }

  function moveFast() {
    socket?.emit('camera:pantilt', {
      panSpeed: 24,
      tiltSpeed: 24,
      panPosition: pan,
      tiltPosition: tilt,
    });

    console.log(zoom);

    socket?.emit('camera:zoom', {
      position: zoom,
    });
  }


  return (
    <div style={{ paddingTop: 20 }}>
      <Container>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <CameraControl
            pan={pan}
            setPan={setPan}
            tilt={tilt}
            setTilt={setTilt}
            zoom={zoom}
            setZoom={setZoom}
          />

          <div className="controls" style={{ paddingLeft: 10, maxWidth: '40%' }}>
            <div>
              <Button
                variant="contained"
                color="primary"
                style={{ marginLeft: 10, marginBottom: 10 }}
                onClick={moveSlow}
              >
                MOVE CAMERA (SLOW)
              </Button>
              <Button
                variant="contained"
                color="primary"
                style={{ marginLeft: 10, marginBottom: 10 }}
                onClick={moveMedium}
              >
                MOVE CAMERA (MEDIUM)
              </Button>
              <Button
                variant="contained"
                color="primary"
                style={{ marginLeft: 10, marginBottom: 10 }}
                onClick={moveFast}
              >
                MOVE CAMERA (FAST)
              </Button>
            </div>
          </div>
        </div>
        <div>
          <TextField
            variant="filled"
            label="Pan"
            disabled
            value={pan}
            style={{ marginRight: 10 }}
          />

          <TextField
            variant="filled"
            label="Tilt"
            disabled
            value={tilt}
            style={{ marginRight: 10 }}
          />

          <TextField
            variant="filled"
            label="Zoom"
            disabled
            value={`${((10 / 16384) * zoom).toFixed(1)}x`}
            style={{ marginRight: 10 }}
          />
        </div>
      </Container>
    </div>
  );
}

export default Camera;
