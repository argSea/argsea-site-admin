import { Admin, Resource, radiantDarkTheme } from "react-admin";
import { authProvider } from "./authProvider";
// User
import { UserList } from "./components/UserList";
import UserCreate from "./components/UserCreate";
import UserEdit from "./components/UserEdit";
import dataProvider from "./dataProvider";
// Project
import { ProjectList } from "./components/ProjectList";
import ProjectEdit from "./components/ProjectEdit";
import ProjectCreate from "./components/ProjectCreate";
// Skill
import { SkillList } from "./components/SkillList";
import SkillEdit from "./components/SkillEdit";
import SkillCreate from "./components/SkillCreate";

export const App = () => (
  <Admin authProvider={authProvider} dataProvider={dataProvider} theme={radiantDarkTheme}>
    <Resource name="user" list={UserList} create={UserCreate} edit={UserEdit} options={{ label: "Me" }} key="id"></Resource>
    <Resource name="project" list={ProjectList} create={ProjectCreate} edit={ProjectEdit} options={{ label: "Projects" }} key="projectID" />
    <Resource name="skill" list={SkillList} create={SkillCreate} edit={SkillEdit} options={{ label: "Skills" }} key="skillID" />
  </Admin>
);
