import { Create, SimpleForm, TextInput } from "react-admin";

const SkillCreate = (props: any) => {
  return (
    <Create {...props}>
      <SimpleForm>
        <TextInput source="name" label="Skill Name" />
        <TextInput source="description" label="Description" />
      </SimpleForm>
    </Create>
  );
};

export default SkillCreate;
