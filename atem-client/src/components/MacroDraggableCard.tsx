import React from 'react';
import { Container, Grid, Drawer, Card, CardHeader, CardContent, Typography } from '@material-ui/core';
import { useDrag } from 'react-dnd';

export function MacroDraggableCard(props: any) {
  const [collectedProps, drag] = useDrag({
    item: { id: props.id, type: 'macro' }
  });

  return (
    <div ref={drag}>
      <Card style={{ minHeight: 220 }}>
        <CardHeader
          title={props.name}
          subheader={props.type === 'camera' && 
            <>
              Pan: { (props.macro?.steps[0]?.properties?.pan || props.macro?.steps[1]?.properties?.pan) || 0 },
              Tilt: { props.macro?.steps[0]?.properties?.tilt || props.macro?.steps[1]?.properties?.tilt || 0 },
              Zoom: { ((10 / 16384) * (props.macro?.steps[0]?.properties?.zoom || props.macro?.steps[1]?.properties?.zoom || 0)).toFixed(1) }x
            </>
          }
        />
        <CardContent>
          <Typography variant="body1" color="textSecondary" component="p">
            { props.macro?.description }
          </Typography>
        </CardContent>
      </Card>
    </div>
  );
}
