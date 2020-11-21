import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Fab,
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
  const [isOpen, setIsOpen] = useState(false);
  const [initialState, setInitialState] = useState({});

  return (
    <div>
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />
      <MacroViewItem />

      <Fab
        color="primary"
        style={{ position: 'fixed', right: 16, bottom: 16 }}
        onClick={() => {
          setInitialState({
            name: '',
            description: '',
            steps: [{ delay: 0, command: 'SET_PREVIEW' }],
          })
          setIsOpen(true);
        }}
      >
        <AddIcon />
      </Fab>

      <MacroForm
        isOpen={isOpen}
        initialValues={initialState}
        onSubmit={() => {}}
      />
    </div>
  );
}
