import React from "react";
import { Grid, Container, Paper } from "@material-ui/core";
import {useAtemState, useSocket} from 'core/SocketContext';
import styled from 'styled-components';

const Button = styled.button<{ isPreview?: boolean, isProgram?: boolean }>`
  width: 100%;
  height: 100px;
  border: 1px solid rgba(0,0,0,0.5);
  border-radius: 4px;
  &:hover {
    box-shadow: 0px 0px 0px 2px rgba(0,0,0,0.3);
  }
`;

const ButtonProgram = styled(Button)`
  background: ${(props: any) => props.isProgram ? '#D32A25': '#F3F3F3' }
`;

const ButtonPreview = styled(Button)`
  background: ${(props: any) => props.isPreview ? '#44B048': '#F3F3F3' }
`;

function Surface() {
  const atemState = useAtemState();
  const socket = useSocket();

  const devices = Object.keys(atemState);

  function setProgram(deviceId: string, input: number) {
    socket?.emit(
      'action:execute',
      {
        id: deviceId,
        type: 'SET_PROGRAM',
        properties: { input }
      })
  }

  function setPreview(deviceId: string, input: number) {
    socket?.emit(
      'action:execute',
      {
        id: deviceId,
        type: 'SET_PREVIEW',
        properties: { input }
      })
  }

  return (
    <Container>
      { devices.map((deviceId: string) => {

        if (atemState[deviceId]?.type === 'birddog') {
          return <div></div>
        }

        const { inputs, video } = atemState[deviceId] || {};
        const me = video.mixEffects[0];

        console.log(me);
        // console.log(inputs);

        const inputsIds = Object.keys(inputs).filter((id) => parseInt(id) < 4000);


        return (
          <Paper key={`surface-${deviceId}`} style={{ padding: '10px 20px' }}>
            <h1>Program</h1>

            <Grid container spacing={2}>
              { inputsIds.map((inputId) => {
                const inputItem = inputs[inputId];
                return (
                  <Grid
                    item
                    xs={3}
                    sm={2}
                    md={2}
                    key={`program-${inputId}`}
                  >
                    <ButtonProgram
                      isProgram={inputItem.inputId === me.programInput}
                      onClick={() => setProgram(deviceId, inputItem.inputId)}
                    >
                      { inputItem.longName }
                    </ButtonProgram>
                  </Grid>
                )
              })}
            </Grid>

            <h1>Preview</h1>
            <Grid container spacing={2}>
              { inputsIds.map((inputId) => {
                const inputItem = inputs[inputId];
                return (
                  <Grid
                    item
                    xs={3}
                    sm={2}
                    md={2}
                    key={`preview-${inputId}`}
                  >
                    <ButtonPreview
                      isPreview={inputItem.inputId === me.previewInput}
                      onClick={() => setPreview(deviceId, inputItem.inputId)}
                    >
                      { inputItem.longName }
                    </ButtonPreview>
                  </Grid>
                )
              })}
            </Grid>
          </Paper>
        );
      })}

      {/*<code style={{ paddingTop: '100px' }}>*/}
      {/*  { JSON.stringify(atemState) }*/}
      {/*</code>*/}
    </Container>
  );
}

export default Surface;
