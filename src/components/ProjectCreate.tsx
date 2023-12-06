import {
  SimpleForm,
  TextInput,
  CheckboxGroupInput,
  NumberInput,
  BooleanInput,
  AutocompleteArrayInput,
  ImageInput,
  ImageField,
  ArrayInput,
  SimpleFormIterator,
  Create,
  DateTimeInput,
} from "react-admin";
import { RichTextInput } from "ra-input-rich-text";
import { getSkillChoices } from "./Skills";

const ProjectCreate = (props: any) => {
  const userID = "6396d88feafa14a262f9915c";
  const skillChoices = getSkillChoices();
  return (
    <Create title="Create a project" {...props}>
      <SimpleForm>
        <ArrayInput source="userIDs" label="Associated UserIDs" defaultValue={userID}>
          <SimpleFormIterator>
            <TextInput source={""} label="UserID" />
          </SimpleFormIterator>
        </ArrayInput>
        <TextInput source="projectType" />
        <TextInput source="name" />
        <TextInput source="shortName" />
        <TextInput source="slug" />
        <DateTimeInput source="createdDate" defaultValue={new Date().toISOString()} />
        <DateTimeInput source="updatedDate" defaultValue={new Date().toISOString()} />
        <DateTimeInput source="publishedDate" />
        <TextInput source="repoURL" label="Repo URL" />
        <RichTextInput source="description" />
        <ImageInput source="icon">
          <ImageField source="src" />
        </ImageInput>
        <ArrayInput source="images">
          <SimpleFormIterator>
            <TextInput source="order" />
            <ImageInput source="image">
              <ImageField source="src" />
            </ImageInput>
          </SimpleFormIterator>
        </ArrayInput>
        <NumberInput source="priority" />
        <BooleanInput source="isActive" />
        <BooleanInput source="isReleased" />
        <BooleanInput source="isHidden" />
        <AutocompleteArrayInput source="skills" autoHighlight={true} autoSelect={true} choices={skillChoices} ChipProps={{ color: "primary" }} />
        <CheckboxGroupInput
          source="roles"
          choices={[
            { id: "developer", name: "Developer" },
            { id: "designer", name: "Designer" },
            { id: "manager", name: "Manager" },
            { id: "tester", name: "Tester" },
            { id: "other", name: "Other" },
          ]}
        />
      </SimpleForm>
    </Create>
  );
};

export default ProjectCreate;
