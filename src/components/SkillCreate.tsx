import { RichTextInput } from "ra-input-rich-text";
import { Create, SimpleForm, TextInput } from "react-admin";

const SkillCreate = (props: any) => {
  return (
    <Create {...props}>
      <SimpleForm>
        <TextInput source="name" label="Skill Name" />
        <RichTextInput source="description" label="Description" />
      </SimpleForm>
    </Create>
  );
};

export default SkillCreate;
