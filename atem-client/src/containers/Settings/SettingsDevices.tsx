import React from "react";
import {useAtemState, useDevices, useSocketState} from "core/SocketContext";
import { Grid, List, ListSubheader, Button, ListItem, ListItemText, ListItemSecondaryAction, IconButton, Paper } from "@material-ui/core";
import AddIcon from '@material-ui/icons/Add';

import DeviceCard from "components/DeviceCard";

function SettingsDevices() {
  const atemState = useDevices();
  const devices = Object.keys(atemState);

  console.log(devices);

  return (
    <div>
      <Grid container spacing={2}>
        <Grid item md={8}>
          { devices.map((deviceId: string) => {

            return (
              <div key={`device-card-${deviceId}`} style={{ marginBottom: 20, }}>
                 <DeviceCard
                    productIdentifier={deviceId}
                    device={atemState[deviceId]}
                 />
              </div>
            );
          })}

          {/*{ devices.map((device: any) => {*/}

          {/*  return (*/}
          {/*    <DeviceCard />*/}
          {/*  );*/}
          {/*})}*/}


        </Grid>
        {/* <Grid item md={4}>
          <Paper>
            <List
              subheader={
                <ListSubheader component="div">
                  <span>Discover Devices</span>
                  <Button>Update</Button>
                </ListSubheader>
              }
            > */}
              {/*{discovery.map((device: any) => {*/}

              {/*  return (*/}
              {/*    <ListItem key={`discovered-item-${device.ip}`}>*/}
              {/*      <ListItemText*/}
              {/*        primary={device.ip}*/}
              {/*        secondary="Manufacturer"*/}
              {/*      />*/}
              {/*      <ListItemSecondaryAction>*/}
              {/*        <IconButton edge="end" aria-label="add">*/}
              {/*          <AddIcon />*/}
              {/*        </IconButton>*/}
              {/*      </ListItemSecondaryAction>*/}
              {/*    </ListItem>*/}
              {/*  )*/}
              {/*})}*/}
            {/* </List>
          </Paper>
        </Grid> */}
      </Grid>
    </div>
  );
}

export default SettingsDevices;
