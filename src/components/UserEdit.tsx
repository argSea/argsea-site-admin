import React from "react";
import {
  Edit,
  SimpleForm,
  TextInput,
  ImageInput,
  ImageField,
  ArrayInput,
  SimpleFormIterator,
} from "react-admin";
import { RichTextInput } from "ra-input-rich-text";

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
        <ImageInput source="picture" />
        <RichTextInput source="about" />
        <ArrayInput source="contacts">
          <SimpleFormIterator>
            <TextInput source="name" />
            <TextInput source="link" />
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
