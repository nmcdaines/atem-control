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
  // isOpen: boolean,

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
        open={true}
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
                          { JSON.stringify(steps) }

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
                                    <TextField
                                      fullWidth
                                      variant="outlined"
                                      label="Command"
                                      margin="dense"
                                      name={`step.${index}.command`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.command || ''}
                                      required
                                    />
                                  </Box>
                                  Properties
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