import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent, DialogContentText,
  TextField,
  Button,
  DialogActions,
  Box,
  Paper,
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import { MacroForm } from "./MacroForm";

interface IMacro {
  id: string;
  name: string;
  steps: IStep[];
}

interface IStep {
  order: number;
  delay: number;
  command: string;
  properties: string;
}


function MacroViewItem() {
  return (
    <Card style={{ marginBottom: 10 }}>
      <CardHeader
        action={
          <IconButton>
            <EditIcon />
          </IconButton>
        }
        title={"Hello world"}
      />
      <CardContent>
        <Typography variant="body2" color="textSecondary" component="p">
          This is where some text goes
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Macros() {


  return (
    <div>
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />

      <Fab color="primary" style={{ position: 'fixed', right: 16, bottom: 16 }}>
        <AddIcon />
      </Fab>

      <MacroForm
        initialValues={{ hello: 'world', steps: [] }}
        onSubmit={() => {}}
      />
    </div>
  );
}
