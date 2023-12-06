import { Admin, Resource, radiantDarkTheme } from "react-admin";
import authProvider from "./authProvider";
import { UserList } from "./components/UserList";
import UserCreate from "./components/UserCreate";
import UserEdit from "./components/UserEdit";
import dataProvider from "./dataProvider";
import { ProjectList } from "./components/ProjectList";
import ProjectEdit from "./components/ProjectEdit";
import ProjectCreate from "./components/ProjectCreate";

export const App = () => (
  <Admin authProvider={authProvider} dataProvider={dataProvider} theme={radiantDarkTheme}>
    <Resource name="user" list={UserList} create={UserCreate} edit={UserEdit} options={{ label: "Me" }} key="id"></Resource>
    <Resource name="project" list={ProjectList} create={ProjectCreate} edit={ProjectEdit} options={{ label: "Projects" }} key="projectID" />
  </Admin>
);
