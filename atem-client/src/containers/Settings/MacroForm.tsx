import React, { useState } from "react";
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
  TextFieldProps,
  StandardTextFieldProps,
  OutlinedTextFieldProps,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import { Formik, FieldArray } from "formik";
import {useAtemState} from "../../core/SocketContext";

const defaultTextFieldProps: any = {
  fullWidth: true,
  variant: "outlined",
  margin: "dense",
}

interface IMacroFormProps {
  isOpen: boolean,

  initialValues: any,
  onSubmit: any;
}

export const MacroForm: React.FC<IMacroFormProps> = (props) => {
  const atemStates = useAtemState();
  const deviceOptions = Object.keys(atemStates).map((id: string) => ({
    id,
    name: atemStates[id].info.productIdentifier,
  }));

  return (
    <Dialog
        open={props.isOpen}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Create / Edit Macro
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Insert a description about how macros work.
          </DialogContentText>

          <Formik
            initialValues={props.initialValues}
            onSubmit={props.onSubmit}
          >
            {({
              values,
              errors,
              touched,
              handleChange,
              handleBlur,
              handleSubmit,
              isSubmitting,
            }) => {

              console.log(values);

              const steps = values.steps || [];

              return (
                <form onSubmit={handleSubmit}>
                  <TextField
                    {...defaultTextFieldProps}
                    label="Name"
                    name="name"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.name}
                    autoFocus
                  />
                  <Box mt={1}>
                    <TextField
                      {...defaultTextFieldProps}
                      label="Description"
                      name="description"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.description}
                    />
                  </Box>
                  <Box mt={1}>
                    <FormControl {...defaultTextFieldProps}>
                      <InputLabel required>
                        Devices
                      </InputLabel>
                      <Select
                        label="Device"
                        name="device"
                        onBlur={handleBlur}
                        onChange={handleChange}
                        value={values.device || ''}
                        required
                      >
                        { deviceOptions.map(({ id, name }) => (
                          <MenuItem value={id}>{name}</MenuItem>
                        )) }
                      </Select>
                    </FormControl>
                  </Box>

                  <Box mt={2}>

                    <FieldArray
                      name="steps"
                      render={arrayHelpers => (
                        <>
                          { steps.map((step: any, index: number) => (
                            <Box
                              key={`step-${index}`}
                              mb={2}
                            >
                              <Paper variant="outlined" style={{ position: 'relative', }}>
                                <div style={{ position: 'absolute', left: 8, top: -10, background: '#FFF', padding: '0px 8px', color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>Step {index}</div>
                                <Box p={2}>
                                  <Box mt={1}>
                                    <TextField
                                      fullWidth
                                      variant="outlined"
                                      label="Delay"
                                      margin="dense"
                                      name={`steps.${index}.delay`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.delay}
                                      required
                                    />
                                  </Box>



                                  <Box mt={1}>
                                    <FormControl {...defaultTextFieldProps}>
                                      <InputLabel required>
                                        Command
                                      </InputLabel>
                                      <Select
                                        label="Command"
                                        name={`steps.${index}.command`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.command || ''}
                                        required
                                      >
                                        <MenuItem value="SET_PROGRAM">Set Program Input</MenuItem>
                                        <MenuItem value="SET_PREVIEW">Set Preview Input</MenuItem>
                                        <MenuItem value="SET_PIP">Set Picture In Picture</MenuItem>
                                        <MenuItem value="TRANSITION_AUTO">Transition AUTO</MenuItem>
                                        <MenuItem value="TRANSITION_CUT">Transition CUT</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Box>
                                  Properties

                                  {step.command != 'SET_PIP' &&
                                    <Box mt={1}>
                                        <TextField
                                            fullWidth
                                            variant="outlined"
                                            label="Input"
                                            margin="dense"
                                            name={`steps.${index}.input`}
                                            onBlur={handleBlur}
                                            onChange={handleChange}
                                            value={step.input || ''}
                                            required={(
                                              step.command === 'SET_PROGRAM' ||
                                              step.command === 'SET_PREVIEW'
                                            )}
                                        />
                                    </Box>
                                  }

                                  { step.command === 'SET_PIP' &&
                                    <>
                                      <Box mt={1}>
                                        <FormControl {...defaultTextFieldProps}>
                                          <InputLabel required>
                                            Command
                                          </InputLabel>
                                          <Select
                                            label="Command"
                                            name={`steps.${index}.direction`}
                                            onBlur={handleBlur}
                                            onChange={handleChange}
                                            value={step.direction || ''}
                                            required
                                          >
                                            <MenuItem value="ON">On</MenuItem>
                                            <MenuItem value="OFF">Off</MenuItem>
                                          </Select>
                                        </FormControl>
                                      </Box>

                                      <Box mt={1}>
                                        <TextField
                                          fullWidth
                                          variant="outlined"
                                          label="Position X"
                                          margin="dense"
                                          name={`steps.${index}.positionX`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.positionX || ''}
                                          required
                                        />
                                      </Box>
                                      <Box mt={1}>
                                        <TextField
                                          fullWidth
                                          variant="outlined"
                                          label="Position Y"
                                          margin="dense"
                                          name={`steps.${index}.positionY`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.positionY || ''}
                                          required
                                        />
                                      </Box>
                                      <Box mt={1}>
                                        <TextField
                                          fullWidth
                                          variant="outlined"
                                          label="Size X"
                                          margin="dense"
                                          name={`steps.${index}.sizeX`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.sizeX || ''}
                                          required
                                        />
                                      </Box>
                                      <Box mt={1}>
                                        <TextField
                                          fullWidth
                                          variant="outlined"
                                          label="Size Y"
                                          margin="dense"
                                          name={`steps.${index}.sizeY`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.sizeY || ''}
                                          required
                                        />
                                      </Box>
                                      <Box mt={1}>
                                        <TextField
                                          fullWidth
                                          variant="outlined"
                                          label="Source"
                                          margin="dense"
                                          name={`steps.${index}.source`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.source || ''}
                                          required={(
                                            step.command === 'SET_PIP'
                                          )}
                                        />
                                      </Box>
                                    </>
                                  }
                                </Box>
                              </Paper>
                            </Box>
                          ))}


                          <Fab
                            variant="extended"
                            size="small"
                            color="primary"
                            onClick={() => arrayHelpers.push({})}
                          >
                            <AddIcon /> Add step
                          </Fab>
                        </>
                      )}
                    />


                  </Box>
                </form>
              )
            }}
          </Formik>
        </DialogContent>
        <DialogActions>
          <Button color="primary">Cancel</Button>
          <Button color="primary">Save</Button>
        </DialogActions>
      </Dialog>
  );
}