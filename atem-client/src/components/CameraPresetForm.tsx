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

const defaultTextFieldProps: any = {
  fullWidth: true,
  variant: "outlined",
  margin: "dense",
}

interface ICameraPresetCreateFormProps {
  isOpen: boolean,

  initialValues: any,
  onSubmit: any;
  onCancel: any;
}

export const CameraPresetForm: React.FC<ICameraPresetCreateFormProps> = (props) => {
  return (
    <Dialog
      open={props.isOpen}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        Create Preset
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

          console.log(values);

          const steps = values.steps || [];

          return (
            <form onSubmit={handleSubmit}>
              <DialogContent>
                <DialogContentText>
                  Save the current Pan/Tilt/Zoom position as a Macro that can be recalled later
                  from the Camera settings or via other Macros.
                </DialogContentText>
                <TextField
                  {...defaultTextFieldProps}
                  label="Name"
                  name="name"
                  onBlur={handleBlur}
                  onChange={handleChange}
                  value={values.name}
                  autoFocus
                  required
                />
                <Box mt={1}>
                  <TextField
                    {...defaultTextFieldProps}
                    label="Description"
                    name="description"
                    onBlur={handleBlur}
                    onChange={handleChange}
                    value={values.description}
                    multiline
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