import { Create, SimpleForm, TextInput, RichTextField } from "react-admin";

const UserCreate = (props: any) => {
  return (
    <Create title="Create a user" {...props}>
      <SimpleForm>
        <TextInput source="userName" />
        <TextInput source="firstName" />
        <TextInput source="lastName" />
        <TextInput source="title" />
        <TextInput source="email" />
        <RichTextField aria-multiline source="about" />
      </SimpleForm>
    </Create>
  );
};

export default UserCreate;
