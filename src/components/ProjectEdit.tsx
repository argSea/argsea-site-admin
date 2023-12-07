import {
  Edit,
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
  DateTimeInput,
  AutocompleteInput,
} from "react-admin";
import { RichTextInput } from "ra-input-rich-text";
import { getSkillChoices } from "./Skills";
import { getRoleChoices } from "./Roles";
import { getProjectTypeChoices } from "./ProjectTypes";

const ProjectEdit = (props: any) => {
  const skillChoices = getSkillChoices();
  return (
    <Edit title="Edit a project" {...props}>
      <SimpleForm>
        <TextInput disabled source="id" />
        <ArrayInput source="userIDs" label="Associated UserIDs">
          <SimpleFormIterator>
            <TextInput source={""} label="UserID" />
          </SimpleFormIterator>
        </ArrayInput>
        <AutocompleteInput source="projectType" choices={getProjectTypeChoices()} />
        <TextInput source="name" />
        <TextInput source="shortName" />
        <TextInput disabled source="slug" />
        {/* created date */}
        {/* updated date */}
        <DateTimeInput source="createdDate" disabled />
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
        <CheckboxGroupInput source="roles" choices={getRoleChoices()} />
      </SimpleForm>
    </Edit>
  );
};

export default ProjectEdit;
