import React from "react";

import { createStyles, makeStyles, Theme, AppBar, Toolbar, Typography, Button} from "@material-ui/core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        title: {
            flexGrow: 1,
        },
        connection: {
            background: 'red',
            borderRadius: '50%',
            height: 10,
            width: 10,
            marginRight: 10,
        }
    })
);

export default function () {
    const classes = useStyles();

    return (
        <AppBar position="static">
            <Toolbar>
                <Typography variant="h6" className={classes.title}>
                    ATEM Control
                </Typography>

                <span className={classes.connection} />
                <Button color="inherit">Connect</Button>
            </Toolbar>
        </AppBar>
    )
}
