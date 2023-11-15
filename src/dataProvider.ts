import simpleRestProvider from "ra-data-simple-rest";
import { withLifecycleCallbacks } from "react-admin";

const dataProvider = withLifecycleCallbacks(simpleRestProvider(""), [
  {
    resource: "users",
    
  }
]);