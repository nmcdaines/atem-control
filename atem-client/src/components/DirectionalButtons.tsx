import React from 'react';
import { Button } from '@material-ui/core';
import { ArrowUpward, ArrowDownward, ArrowBack, ArrowForward } from '@material-ui/icons';

interface IDirectionButtonsProps {
  onUp: any;
  onDown: any;
  onLeft: any;
  onRight: any;
}

const baseStyles: any = {
  position: 'absolute',
  padding: 12,
  minWidth: 36,
}

function DirectionalButtons ({ onUp, onDown, onRight, onLeft }: IDirectionButtonsProps) {
  

  return (
    <div style={{ margin: 10 }}>
      <div style={{ padding: 20, width: 140, height: 140, position: 'relative' }}>
        <div
          style={{
            border: '1px solid rgba(0,0,0,0.4)',
            width: '100%',
            height: '100%',
            borderRadius: '100%'
          }}
        />

        <Button
          variant="contained"
          style={{ ...baseStyles, top: 0, left: '50%', transform: 'translateX(-50%)' }}
          onClick={onUp}
        >
          <ArrowUpward />
        </Button>

        <Button
          variant="contained"
          style={{ ...baseStyles, bottom: 0, left: '50%', transform: 'translateX(-50%)' }}
          onClick={onDown}
        >
          <ArrowDownward />
        </Button>

        <Button
          variant="contained"
          style={{ ...baseStyles, top: '50%', left: 0, transform: 'translateY(-50%)' }}
          onClick={onLeft}
        >
          <ArrowBack />
        </Button>

        <Button
          variant="contained"
          style={{ ...baseStyles, top: '50%', right: 0, transform: 'translateY(-50%)' }}
          onClick={onRight}
        >
          <ArrowForward />
        </Button>
      </div>
    </div>
  )
}

export default DirectionalButtons;
