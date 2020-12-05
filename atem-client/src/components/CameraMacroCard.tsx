import React from 'react';
import Card from '@material-ui/core/Card';
import Typography from '@material-ui/core/Typography';
import { CardHeader, CardContent, CardActions, IconButton, Button  } from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import { useSocket } from 'core/SocketContext';

export function CameraMacroCard({ id, device, name, description, steps }: any) {
  const socket = useSocket();

  function run() {
    socket?.emit('macro:execute:id', { id })
  }

  return (
    <Card>
      <CardContent>
        <Typography gutterBottom variant="h5" component="h2">
          { name }
        </Typography>
        <Typography variant="body1" color="textSecondary" component="p">
          { description }
        </Typography>
        <Typography variant="body1" color="secondary" component="p">
          {/* {JSON.stringify(steps)} */}
          Pan: { (steps[0]?.properties?.pan || steps[1]?.properties?.pan) || 0 },
          Tilt: { steps[0]?.properties?.tilt || steps[1]?.properties?.tilt || 0 },
          Zoom: { ((10 / 16384) * (steps[0]?.properties?.zoom || steps[1]?.properties?.zoom || 0)).toFixed(1) }x
        </Typography>
      </CardContent>
      <CardActions style={{ justifyContent: 'space-between' }}>
        {/* <Button
          // onClick={run}
        >
          Delete
        </Button> */}

        <Button 
          color="primary"
          onClick={run}
        >
          Run <PlayArrowIcon />
        </Button>
      </CardActions>
    </Card>
  )
}
