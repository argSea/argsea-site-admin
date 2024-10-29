import { RichTextInput } from "ra-input-rich-text";
import { Edit, SimpleForm, TextInput } from "react-admin";

const ProjectEdit = (props: any) => {
  return (
    <Edit title="Edit a project" {...props}>
      <SimpleForm sx={{ display: "flex" }}>
        <TextInput disabled source="id" />
        <TextInput source="name" />
        <RichTextInput source="description" label="Description" />
      </SimpleForm>
    </Edit>
  );
};

export default ProjectEdit;
