import React from "react";

import {createStyles, makeStyles, Theme, AppBar, Toolbar, Typography, Button} from "@material-ui/core";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {Link} from "react-router-dom";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      zIndex: 2,
      transform: 'translate(0px)'
    },
    title: {
      flexGrow: 1,
    },
    connection: {
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
  {text: 'SURFACE', to: '/'},
  {text: 'SHORTCUTS', to: '/shortcuts'},
  {text: 'SETTINGS', to: '/settings'},
  {text: 'LIVESTREAM', to: '/livestream'},
]

export default function () {
  const classes = useStyles();

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
            <span className={classes.connection}/>
            Connect
          </Button>
        </div>

      </Toolbar>
    </AppBar>
  )
}
