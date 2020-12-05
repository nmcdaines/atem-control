import React, { useState } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Typography,
  IconButton,
  Fab,
  CardActions,
  Button
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import AddIcon from "@material-ui/icons/Add";
import { MacroForm } from "./MacroForm";
import { useSocket, useMacros } from 'core/SocketContext';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';

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


function MacroViewItem({ macro, onEdit }: any) {
  const socket = useSocket();

  const { steps = [] } = macro;

  function run() {
    socket?.emit('macro:execute:id', { id: macro.id })
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <CardHeader
        action={
          <IconButton>
            <EditIcon onClick={onEdit}/>
          </IconButton>
        }
        title={macro.name}
        subheader={macro.type === 'camera' && 
          <>
            Pan: { (steps[0]?.properties?.pan || steps[1]?.properties?.pan) || 0 },
            Tilt: { steps[0]?.properties?.tilt || steps[1]?.properties?.tilt || 0 },
            Zoom: { ((10 / 16384) * (steps[0]?.properties?.zoom || steps[1]?.properties?.zoom || 0)).toFixed(1) }x
          </>
        }
      />
      <CardContent>
        <Typography variant="body1" color="textSecondary" component="p">
          { macro.description }
        </Typography>
      </CardContent>
      {/* <Button
          // onClick={run}
        >
          Delete
        </Button>

        <Button 
          color="primary"
          onClick={run}
        >
          Run <PlayArrowIcon />
        </Button> */}
    </Card>
  );
}

export default function Macros() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialState, setInitialState] = useState<any>({});
  const [mode, setMode] = useState('create');
  const socket = useSocket();
  const macros = useMacros();
  
  function createMacro(macro: any) {
    if (mode === 'edit') {
      socket?.emit('macro:update', macro);
      setIsOpen(false);
      return;
    } 

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
            onEdit={() => {
              setMode('edit');
              setInitialState({
                ...macros[macroId],
              });
              setIsOpen(true);
            }}
            mode={mode}
          />
        );
      })}

      <Fab
        color="primary"
        style={{ position: 'fixed', right: 16, bottom: 16 }}
        onClick={() => {
          setMode('create');
          setInitialState({
            name: '',
            description: '',
            steps: [{ delay: 0, command: 'SET_PREVIEW' }],
          });
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
        mode={mode}
      />
    </div>
  );
}
