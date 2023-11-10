import React from "react";
import {
  List,
  Datagrid,
  TextField,
  EmailField,
  EditButton,
  DeleteButton,
} from "react-admin";

export const UserList = (props: any) => {
  return (
    <List {...props}>
      <Datagrid rowClick="edit">
        <TextField source="userName" />
        <EmailField source="email" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};
