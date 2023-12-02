import { Admin, Resource } from "react-admin";
import authProvider from "./authProvider";
import restProvider from "ra-data-simple-rest";
import { UserList } from "./components/UserList";
import UserCreate from "./components/UserCreate";
import UserEdit from "./components/UserEdit";
import dataProvider from "./dataProvider";

const userID = "6396d88feafa14a262f9915c";

export const App = () => (
  <Admin authProvider={authProvider} dataProvider={dataProvider}>
    <Resource
      name="user"
      list={UserList}
      create={UserCreate}
      edit={UserEdit}
      // edit={EditGuesser}
      // show={ShowGuesser}
      options={{ label: "Me" }}
      key="userID"
    />
  </Admin>
);
