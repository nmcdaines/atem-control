import React from 'react';
import { Button } from '@material-ui/core';

interface IZoomButtonsProps {
  onT: any;
  onW: any;
}

const baseStyles: any = {
  position: 'absolute',
  padding: 12,
  minWidth: 50,
  fontWeight: '600'
}

function DirectionalButtons ({ onT, onW }: IZoomButtonsProps) {
  

  return (
    <div style={{ margin: 10 }}>
      <div style={{ padding: 20, width: 140, height: 140, position: 'relative' }}>
        <Button
          variant="contained"
          style={{ ...baseStyles, bottom: 'calc(50% + 10px)' }}
          onClick={onT}
        >
          T
        </Button>

        <Button
          variant="contained"
          style={{ ...baseStyles, top: 'calc(50% + 10px)' }}
          onClick={onW}
        >
          W
        </Button>
      </div>
    </div>
  )
}

export default DirectionalButtons;
