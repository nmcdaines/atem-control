import React from "react";

import {createStyles, Theme, makeStyles} from '@material-ui/core/styles';
import List from '@material-ui/core/List';
import ListItem, {ListItemProps} from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Divider from '@material-ui/core/Divider';
import InboxIcon from '@material-ui/icons/Inbox';
import DeviceHubIcon from '@material-ui/icons/DeviceHub';
import LiveTvIcon from '@material-ui/icons/LiveTv';
import DraftsIcon from '@material-ui/icons/Drafts';
import CallToActionIcon from '@material-ui/icons/CallToAction';
import AppsIcon from '@material-ui/icons/Apps';


import { Link, useRouteMatch, useParams } from "react-router-dom";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.palette.background.paper,
    },
  }),
);

function ListItemLink(props: ListItemProps<Link, { button?: true, to: string }>) {
  return <ListItem button component={Link} {...props} />;
}

function SettingsItem({name, icon, onClick}: any) {
  const IconComponent = icon;
  const itemId = String(name).toLowerCase();

  let { settingId } = useParams();

  return (
    <ListItemLink
      button
      selected={itemId === settingId}
      onClick={onClick}
      to={`/settings/${itemId}`}
    >
      {!!IconComponent &&
      <ListItemIcon>
          <IconComponent/>
      </ListItemIcon>
      }
      <ListItemText primary={name}/>
    </ListItemLink>
  );
}

export default function SettingsNavigation() {
  const classes = useStyles();



  return (
    <div className={classes.root}>
      <List component="nav">
        <SettingsItem name="Devices" icon={DeviceHubIcon}/>
        <SettingsItem name="Livestream" icon={LiveTvIcon}/>
      </List>
      <Divider/>
      <List component="nav">
        <SettingsItem name="Macros" icon={CallToActionIcon}/>
        <SettingsItem name="Shortcuts" icon={AppsIcon}/>
      </List>
    </div>
  );
}
