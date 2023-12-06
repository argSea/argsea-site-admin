import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DeleteButton,
  BooleanField,
  ChipField,
  SingleFieldList,
  ArrayField,
  FunctionField,
  DateField,
} from "react-admin";

export const ProjectList = () => {
  const userID = "6396d88feafa14a262f9915c";
  return (
    <List resource="project" filter={{ userID }}>
      <Datagrid rowClick="edit">
        {/* <TextField source="id" /> */}5
        <TextField source="name" />
        <TextField source="description" sx={{ maxWidth: "200px", textOverflow: "ellipsis" }} />
        <DateField source="updatedDate" />
        <ArrayField source="skills" label="Skills">
          <SingleFieldList>
            <FunctionField render={(record: any) => <ChipField record={{ name: record }} source="name" />} />
          </SingleFieldList>
        </ArrayField>
        <TextField source="priority" />
        <BooleanField source="isActive" label="Active" />
        <BooleanField source="isReleased" label="Released" />
        <BooleanField source="isHidden" label="Hidden" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};
