import React, { useState } from "react";
import { Button, Container, TextField } from '@material-ui/core';
import { useSocket, useDevices } from "core/SocketContext";
import CameraControl from 'components/CameraControl';
import CameraControlSimple from 'components/CameraControlSimple';

function Camera() {
  const socket = useSocket();
  const devices = useDevices();


  return (
    <div style={{ paddingTop: 20 }}>
      <Container>

        { Object.keys(devices).map((deviceId) => {
          if (devices[deviceId].type !== 'birddog') { return null; }

          return (
            <div key={`device-${deviceId}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>{ devices[deviceId].name }</div>

                <Button variant="contained" color="secondary">
                  Save Preset
                </Button>
              </div>

              
              <CameraControlSimple
                deviceId={deviceId}
                name={devices[deviceId].name}
                {...devices[deviceId]}
              />
            </div>
          )
        }) }

      </Container>
    </div>
  );
}

export default Camera;
