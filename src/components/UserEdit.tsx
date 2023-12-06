import { Edit, SimpleForm, TextInput, ImageInput, ImageField, ArrayInput, SimpleFormIterator } from "react-admin";
import { RichTextInput } from "ra-input-rich-text";
import "../styles/userEdit.css";

const UserEdit = (props: any) => {
  return (
    <Edit title="Edit a user" {...props}>
      <SimpleForm>
        <TextInput disabled source="id" />
        <TextInput source="userName" />
        <TextInput source="firstName" />
        <TextInput source="lastName" />
        <TextInput source="title" />
        <TextInput source="email" />
        <ImageInput source="picture">
          <ImageField source="src" className="user-edit-me-avatar" />
        </ImageInput>
        <RichTextInput source="about" />
        <ArrayInput source="contacts" className="user-edit-me-contacts">
          <SimpleFormIterator inline>
            <TextInput source="name" fullWidth={true} />
            <TextInput source="link" fullWidth={true} />
            <ImageInput source="icon" accept="image/*">
              <ImageField source="src" />
            </ImageInput>
          </SimpleFormIterator>
        </ArrayInput>
        <ArrayInput source="techInterests" className="user-edit-me-techInterests">
          <SimpleFormIterator inline>
            <TextInput source="name" fullWidth={true} />
            <TextInput source="interestLevel" fullWidth={true} />
            <ImageInput source="icon" accept="image/*">
              <ImageField source="src" />
            </ImageInput>
          </SimpleFormIterator>
        </ArrayInput>
      </SimpleForm>
    </Edit>
  );
};

export default UserEdit;
