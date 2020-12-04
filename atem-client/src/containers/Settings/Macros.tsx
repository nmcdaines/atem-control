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
import { useSocket, useMacros } from 'core/SocketContext';

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


function MacroViewItem({ macro }: any) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <CardHeader
        action={
          <IconButton>
            <EditIcon />
          </IconButton>
        }
        title={macro.name}
      />
      <CardContent>
        <Typography variant="body2" color="textSecondary" component="p">
          {macro.description}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Macros() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialState, setInitialState] = useState({});
  const socket = useSocket();
  const macros = useMacros();
  
  function createMacro(macro: any) {
    socket?.emit('macro:create', macro);
    setIsOpen(false);
  }

  return (
    <div>

      { Object.keys(macros).map((macroId) => {

        return (
          <MacroViewItem
            key={`macro-${macroId}`}
            macro={macros[macroId]}
          />
        );
      })}

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
        onSubmit={createMacro}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  );
}
