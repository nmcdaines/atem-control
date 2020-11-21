import React from "react";
import { Card, CardHeader, Avatar, IconButton, CardMedia, CardContent, Typography } from "@material-ui/core";
import { makeStyles, Theme, createStyles } from '@material-ui/core/styles';
import MoreVertIcon from '@material-ui/icons/MoreVert';
import { red } from '@material-ui/core/colors';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      maxWidth: '100%',
    },
    expand: {
      transform: 'rotate(0deg)',
      marginLeft: 'auto',
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
    },
    avatar: {
      backgroundColor: red[500],
    },
  }),
);

function DeviceCard({ productIdentifier }: any) {
  const classes = useStyles();

return (
    <Card className={classes.root}>
      <CardHeader
        action={
          <IconButton aria-label="settings">
            <MoreVertIcon />
          </IconButton>
        }
        title="ATEM Mini Pro ISO"
        subheader="192.168.0.218"
      />
      <CardContent>
        <Typography variant="body2" color="textSecondary" component="p">
          { productIdentifier }

        </Typography>
      </CardContent>
    </Card>
  );
}

export default DeviceCard;
