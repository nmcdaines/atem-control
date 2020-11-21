import React from "react";
import {useAtemState, useSocket} from 'core/SocketContext';
import styled from 'styled-components';

const Button = styled.button<{ isPreview?: boolean, isProgram?: boolean }>`
  width: 100px;
  height: 100px;
  margin-right: 10px;
`;

const ButtonProgram = styled(Button)`
  background: ${(props: any) => props.isProgram ? 'red': 'grey' }
`;

const ButtonPreview = styled(Button)`
  background: ${(props: any) => props.isPreview ? 'green': 'grey' }
`;

function Surface() {
  const atemState = useAtemState();
  const socket = useSocket();

  const devices = Object.keys(atemState);

  function setProgram(input: number) {
    socket?.emit(
      'action:execute',
      {
        id: '88ccfdaa-ffa0-492c-a659-9fe716260f52',
        type: 'SET_PROGRAM',
        properties: { input }
      })
  }

  function setPreview(input: number) {
    socket?.emit(
      'action:execute',
      {
        id: '88ccfdaa-ffa0-492c-a659-9fe716260f52',
        type: 'SET_PREVIEW',
        properties: { input }
      })
  }

  return (
    <div>
      { devices.map((deviceId: string) => {

        const { inputs, video } = atemState[deviceId] || {};
        const me = video.mixEffects[0];

        console.log(me);
        // console.log(inputs);

        const inputsIds = Object.keys(inputs).filter((id) => parseInt(id) < 4000);


        return (
          <div key={`surface-${deviceId}`}>
            <h1>Program</h1>
            { inputsIds.map((inputId) => {
              const inputItem = inputs[inputId];
              return (
                <ButtonProgram
                  key={`program-${inputId}`}
                  isProgram={inputItem.inputId === me.programInput}
                  onClick={() => setProgram(inputItem.inputId)}
                >
                  { inputItem.longName }
                </ButtonProgram>
              )
            })}

            <h1>Preview</h1>
            { inputsIds.map((inputId) => {
              const inputItem = inputs[inputId];
              return (
                <ButtonPreview
                  key={`preview-${inputId}`}
                  isPreview={inputItem.inputId === me.previewInput}
                  onClick={() => setPreview(inputItem.inputId)}
                >
                  { inputItem.longName }
                </ButtonPreview>
              )
            })}
          </div>
        );
      })}

      {/*<code style={{ paddingTop: '100px' }}>*/}
      {/*  { JSON.stringify(atemState) }*/}
      {/*</code>*/}
    </div>
  );
}

export default Surface;
