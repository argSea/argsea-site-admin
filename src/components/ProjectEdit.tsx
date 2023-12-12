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
  SelectInput,
} from "react-admin";
import { RichTextInput } from "ra-input-rich-text";
import { getSkillChoices } from "./Skills";
import { getRoleChoices } from "./Roles";
import { getProjectTypeChoices } from "./ProjectTypes";
import { getLinkTypeChoices } from "./LinkTypes";

const ProjectEdit = (props: any) => {
  const skillChoices = getSkillChoices();
  return (
    <Edit title="Edit a project" {...props}>
      <SimpleForm sx={{ display: "flex" }}>
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
        <NumberInput source="priority" />
        <BooleanInput source="isActive" />
        <BooleanInput source="isReleased" />
        <BooleanInput source="isHidden" />
        <hr style={{ width: "100%" }} />
        <RichTextInput source="description" />
        <AutocompleteArrayInput source="skills" autoHighlight={true} autoSelect={true} choices={skillChoices} ChipProps={{ color: "primary" }} />
        <CheckboxGroupInput source="roles" choices={getRoleChoices()} />
        {/* <ImageInput source="icon">
          <ImageField source="src" />
        </ImageInput> */}
        <ArrayInput source="links">
          <SimpleFormIterator inline>
            <SelectInput source="type" choices={getLinkTypeChoices()} />
            <TextInput source="text" />
            <TextInput source="url" label="URL" />
          </SimpleFormIterator>
        </ArrayInput>
        <hr style={{ width: "100%" }} />
        <ArrayInput source="images">
          <SimpleFormIterator>
            <NumberInput source="order" />
            <ImageInput source="image">
              <ImageField source="src" />
            </ImageInput>
          </SimpleFormIterator>
        </ArrayInput>
        {/* <ArrayInput source="snippets">
          <SimpleFormIterator inline>
            <TextInput source="name" />
            <TextInput source="code" multiline />
          </SimpleFormIterator>
        </ArrayInput> */}
      </SimpleForm>
    </Edit>
  );
};

export default ProjectEdit;
