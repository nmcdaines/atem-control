import React from "react";
import { useSocketState } from "core/SocketContext";
import { Grid, List, ListSubheader, Button, ListItem, ListItemIcon, ListItemText, ListItemSecondaryAction, IconButton } from "@material-ui/core";
import SendIcon from '@material-ui/icons/Send';
import AddIcon from '@material-ui/icons/Add';

function SettingsDevices() {
  const { discovery }: any = useSocketState();

  // console.table(state.devices);
  // console.table(state.discovery);

  return (
    <div>
      <Grid container spacing={2}>
        <Grid item md={8}>

        </Grid>
        <Grid item md={4}>
          <List
            subheader={
              <ListSubheader component="div">
                <span>Discover Devices</span>
                <Button>Update</Button>
              </ListSubheader>
            }
          >
            {discovery.map((device: any) => {

              return (
                <ListItem>
                  <ListItemText
                    primary={device.ip}
                    secondary="Manufacturer"
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" aria-label="add">
                      <AddIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              )
            })}
          </List>
        </Grid>
      </Grid>
    </div>
  );
}

export default SettingsDevices;
