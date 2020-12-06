import React from "react";

import {createStyles, makeStyles, Theme, AppBar, Toolbar, Typography, Button} from "@material-ui/core";
import {Link} from "react-router-dom";
import { useIsConnected } from 'core/SocketContext';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      zIndex: 2,
      transform: 'translate(0px)'
    },
    title: {
      flexGrow: 1,
    },
    connected: {
      background: 'green',
      borderRadius: '50%',
      height: 10,
      width: 10,
      marginRight: 10,
    },
    disconnected: {
      background: 'red',
      borderRadius: '50%',
      height: 10,
      width: 10,
      marginRight: 10,
    },
    actionArea: {
      flexGrow: 1,
      textAlign: 'right',
      display: 'flex',
      justifyContent: 'flex-end',
    }
  })
);

const links = [
  {text: 'SURFACE', to: '/surface'},
  {text: 'CAMERA', to: '/camera'},
  {text: 'SHORTCUTS', to: '/shortcuts'},
  {text: 'SETTINGS', to: '/settings'},
  {text: 'LIVESTREAM', to: '/livestream'},
]

export default function () {
  const classes = useStyles();
  const isConnected = useIsConnected();

  return (
    <AppBar position="static" className={classes.root}>
      <Toolbar>
        <Typography variant="h6" className={classes.title}>
          ATEM Control
        </Typography>

        <div>
          { links.map((link) => (
            <Button
              key={`menu-link-${link.text}`}
              color="inherit"
              component={Link}
              to={link.to}
            >
              { link.text }
            </Button>
          ))}
        </div>

        <div className={classes.actionArea}>
          <Button color="inherit">
            <span className={ isConnected ? classes.connected : classes.disconnected }/>
            { isConnected ? 'Connected' : 'Disconnected' }
          </Button>
        </div>

      </Toolbar>
    </AppBar>
  )
}
