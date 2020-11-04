import React from "react";
import {createStyles, Grid, Theme, makeStyles, Paper} from "@material-ui/core"

import SettingsNavigation from "../../components/SettingsNavigation";

import { Route, Redirect, useRouteMatch, useLocation } from "react-router-dom";
import SettingsDevices from "./SettingsDevices";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      // marginTop: theme.spacing(1),
      padding: theme.spacing(2),
    }
  })
);

function Settings() {
  const classes = useStyles();

  let { path, url } = useRouteMatch();
  let location = useLocation();

  return (
    <Grid container className={classes.root}>
      <Grid item md={3}>
        <Route path={`${path}/:settingId`}>
          <SettingsNavigation />
        </Route>
      </Grid>
      <Grid item md={9}>
        <Paper>
          <Route exact path={path}>
            <Redirect
              to={{
                pathname: `${url}/devices`,
                state: { from: location }
              }}
            />
          </Route>
          <Route path={`${path}/devices`}>
            <SettingsDevices />
          </Route>
          <Route path={`${path}/livestream`}>
            Livestream
          </Route>
          <Route path={`${path}/macros`}>
            Macros
          </Route>
          <Route path={`${path}/shortcuts`}>
            Shortcuts
          </Route>
        </Paper>
      </Grid>
    </Grid>
  );
}

export default Settings;
