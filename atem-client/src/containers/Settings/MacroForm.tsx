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
import { useDevices } from "../../core/SocketContext";

const defaultTextFieldProps: any = {
  fullWidth: true,
  variant: "outlined",
  margin: "dense",
}

interface IMacroFormProps {
  isOpen: boolean,

  initialValues: any,
  onSubmit: any;
  onCancel: any;
  mode?: any;
}

export const MacroForm: React.FC<IMacroFormProps> = (props) => {
  const devices = useDevices();
  const deviceOptions = Object.keys(devices).map((id: string) => ({
    id,
    name: devices[id].name,
  }));

  return (
    <Dialog
      open={props.isOpen}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {props.mode === 'edit' ? 'Edit' : 'Create'} Macro
        </DialogTitle>


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
          const steps = values.steps || [];

          return (
            <form onSubmit={handleSubmit}>
              <DialogContent>
                <DialogContentText>
                  Insert a description about how macros work.
                </DialogContentText>
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
                      Device
                      </InputLabel>
                    <Select
                      label="Device"
                      name="device"
                      onBlur={handleBlur}
                      onChange={handleChange}
                      value={values.device || ''}
                      required
                    >
                      {deviceOptions.map(({ id, name }) => (
                        <MenuItem value={id}>{name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <Box mt={2}>
                  <FieldArray
                    name="steps"
                    render={arrayHelpers => (
                      <>
                        {steps.map((step: any, index: number) => (
                          <Box
                            key={`step-${index}`}
                            mb={2}
                          >
                            <Paper variant="outlined" style={{ position: 'relative', }}>
                              <div style={{ position: 'absolute', left: 8, top: -10, background: '#FFF', padding: '0px 8px', color: 'rgba(0,0,0,0.5)', fontSize: 14 }}>Step {index}</div>
                              <Box p={2}>

                                <Box mt={1}>
                                  <FormControl {...defaultTextFieldProps}>
                                    <InputLabel>
                                      Device
                                      </InputLabel>
                                    <Select
                                      label="Device"
                                      name={`steps.${index}.device`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.device || ''}
                                    >
                                      <MenuItem value={''}>Inherit</MenuItem>
                                      {deviceOptions.map(({ id, name }) => (
                                        <MenuItem value={id}>{name}</MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                </Box>

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
                                      <MenuItem value="VISCA_SET_PAN_TILT">Visca Set Pan Tilt</MenuItem>
                                      <MenuItem value="VISCA_SET_ZOOM">Visca Set Zoom</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Box>
                                <div>Properties</div>

                                { JSON.stringify(step) }

                                {( step.command === 'VISCA_SET_PAN_TILT') &&
                                  <Box mt={1}>
                                    <TextField
                                      fullWidth
                                      variant="outlined"
                                      label="Pan"
                                      margin="dense"
                                      name={`steps.${index}.properties.pan`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.properties?.pan || 0}
                                      required={(
                                        step.command === 'VISCA_SET_PAN_TILT'
                                      )}
                                    />
                                    <Box mt={1}>
                                      <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Pan Speed"
                                        margin="dense"
                                        name={`steps.${index}.properties.panSpeed`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.properties?.panSpeed || 0}
                                        required={(
                                          step.command === 'VISCA_SET_PAN_TILT'
                                        )}
                                      />
                                    </Box>
                                    <Box mt={1}>
                                      <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Tilt"
                                        margin="dense"
                                        name={`steps.${index}.properties.tilt`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.properties?.tilt || 0}
                                        required={(
                                          step.command === 'VISCA_SET_PAN_TILT'
                                        )}
                                      />
                                    </Box>
                                    <Box mt={1}>
                                      <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Tilt Speed"
                                        margin="dense"
                                        name={`steps.${index}.properties.tiltSpeed`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.properties?.tiltSpeed || 0}
                                        required={(
                                          step.command === 'VISCA_SET_PAN_TILT'
                                        )}
                                      />
                                    </Box>
                                  </Box>
                                }

                                {( step.command === 'VISCA_SET_ZOOM' ) &&
                                  <Box mt={1}>
                                    <TextField
                                      fullWidth
                                      variant="outlined"
                                      label="Zoom"
                                      margin="dense"
                                      name={`steps.${index}.properties.zoom`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.properties?.zoom || 0}
                                      required={(
                                        step.command === 'VISCA_SET_ZOOM'
                                      )}
                                    />
                                  </Box>
                                }

                                {(step.command != 'SET_PIP' && step.command != 'VISCA_SET_PAN_TILT' && step.command != 'VISCA_SET_ZOOM' ) &&
                                  <Box mt={1}>
                                    <TextField
                                      fullWidth
                                      variant="outlined"
                                      label="Input"
                                      margin="dense"
                                      name={`steps.${index}.properties.input`}
                                      onBlur={handleBlur}
                                      onChange={handleChange}
                                      value={step.properties?.input || ''}
                                      required={(
                                        step.command === 'SET_PROGRAM' ||
                                        step.command === 'SET_PREVIEW'
                                      )}
                                    />
                                  </Box>
                                }

                                {step.command === 'SET_PIP' &&
                                  <>
                                    <Box mt={1}>
                                      <FormControl {...defaultTextFieldProps}>
                                        <InputLabel required>
                                          Command
                                          </InputLabel>
                                        <Select
                                          label="Command"
                                          name={`steps.${index}.properties.direction`}
                                          onBlur={handleBlur}
                                          onChange={handleChange}
                                          value={step.properties?.direction || ''}
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
                                        name={`steps.${index}.properties.positionX`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.properties?.positionX || ''}
                                        required
                                      />
                                    </Box>
                                    <Box mt={1}>
                                      <TextField
                                        fullWidth
                                        variant="outlined"
                                        label="Position Y"
                                        margin="dense"
                                        name={`steps.${index}.properties.positionY`}
                                        onBlur={handleBlur}
                                        onChange={handleChange}
                                        value={step.properties?.positionY || ''}
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
                                        value={step.properties?.sizeX || ''}
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
                                        value={step.properties?.sizeY || ''}
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
                                        value={step.properties?.source || ''}
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
              </DialogContent>
              <DialogActions>
                <Button color="primary" onClick={props.onCancel}>Cancel</Button>
                <Button color="primary" type="submit">Save</Button>
              </DialogActions>
            </form>
          )
        }}
      </Formik>
    </Dialog>
  );
}