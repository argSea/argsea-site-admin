import { Edit, SimpleForm, TextInput } from "react-admin";
import { RichTextInput } from "ra-input-rich-text";

const ProjectEdit = (props: any) => {
  return (
    <Edit title="Edit a project" {...props}>
      <SimpleForm sx={{ display: "flex" }}>
        <TextInput disabled source="id" />

        <TextInput source="name" />

        <RichTextInput source="description" />
      </SimpleForm>
    </Edit>
  );
};

export default ProjectEdit;
