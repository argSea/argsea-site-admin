import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DeleteButton,
  BooleanField,
  ChipField,
  SingleFieldList,
  ArrayField,
  FunctionField,
  DateField,
} from "react-admin";
import { getSkillChoices } from "./Skills";
import { useEffect, useState } from "react";

export const ProjectList = () => {
  const [skillChoices, setSkillChoices] = useState([{} as any]);
  const [loading, setLoading] = useState(true);
  const userID = "6396d88feafa14a262f9915c";

  useEffect(() => {
    getSkillChoices().then((choices) => {
      // take choices in format {id: blah, name: blah} and convert to associated array keyed on id
      choices = choices.reduce((acc: any, choice: any) => {
        acc[choice.id] = choice;
        return acc;
      }, {});

      console.log(choices);

      setSkillChoices(choices);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <List resource="project" filter={{ userID }}>
      <Datagrid rowClick="edit">
        {/* <TextField source="id" /> */}5
        <TextField source="name" />
        <TextField source="shortDescription" sx={{ maxWidth: "200px", textOverflow: "ellipsis" }} />
        <DateField source="updatedDate" />
        <ArrayField source="skills" label="Skills">
          <SingleFieldList>
            <FunctionField
              render={(record: any) => <ChipField record={{ name: skillChoices[record]?.name }} source="name" tooltip={skillChoices[record]?.description} />}
            />
          </SingleFieldList>
        </ArrayField>
        <TextField source="priority" />
        <BooleanField source="isActive" label="Active" />
        <BooleanField source="isReleased" label="Released" />
        <BooleanField source="isHidden" label="Hidden" />
        <EditButton />
        <DeleteButton />
      </Datagrid>
    </List>
  );
};
