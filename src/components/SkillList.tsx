import { List, Datagrid, TextField, EditButton, DeleteButton } from "react-admin";

export const SkillList = (props: any) => {
  return (
    <List {...props}>
      <Datagrid rowClick="edit">
        <TextField source="name" />
        <TextField source="description" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};
