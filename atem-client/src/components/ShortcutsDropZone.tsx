import React from 'react';
import { useDrop } from 'react-dnd';
import { useSocket, useMacros } from 'core/SocketContext';
import { Card, CardContent, Typography, CardHeader, CardActions, Button } from '@material-ui/core';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';

export function ShortcutsDropZone(props: any) {
  const socket = useSocket();
  const macros = useMacros();

  const [collectedProps, drop] = useDrop({
    accept: 'macro',
    drop: (item: any, monitor) => {
      console.log(item, monitor);

      socket?.emit('shortcut:create', {
        page: props.page,
        slot: props.slot, 
        command: 'MACRO',
        value: item.id,
      })
    }
  });

  console.log(props);

  function run() {
    socket?.emit('macro:execute:id', { id: props.shortcut.value })
  }

  function onDelete() {
    socket?.emit('shortcut:delete', { id: props.shortcut.id })
  }

  if (!props.shortcut) {
    return (
      <div
        ref={drop}
        style={{ width: '100%', height: '100%', minHeight: 200, border: '2px dashed rgba(0,0,0,0.12)', borderRadius: 8}}
      >
        { props.slot }
      </div>
    );
  }

  const macro = macros[props.shortcut.value] || {};
  const steps = macro.steps || [];

  return (
    <Card style={{ width: '100%', height: '100%', minHeight: 200 }}>
      <CardHeader
        title={macro.name}
        subheader={macro.type === 'camera' && 
          <>
            Pan: { (steps[0]?.properties?.pan || steps[1]?.properties?.pan) || 0 },
            Tilt: { steps[0]?.properties?.tilt || steps[1]?.properties?.tilt || 0 },
            Zoom: { ((10 / 16384) * (steps[0]?.properties?.zoom || steps[1]?.properties?.zoom || 0)).toFixed(1) }x
          </>
        }
      />
      <CardContent>
        <Typography variant="body1" color="textSecondary" component="p">
          { macro?.description }
        </Typography>
      </CardContent>
      <CardActions style={{ justifyContent: 'space-between' }}>
        { props.edit &&
          <Button
            onClick={onDelete}
          > 
            Delete
          </Button>
        }

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
