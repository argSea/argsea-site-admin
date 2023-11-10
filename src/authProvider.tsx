import { AUTH_LOGIN } from "react-admin";
import API from "./lib/API";

export default (type: string, params: any) => {
  if (type === AUTH_LOGIN) {
    const { username, password } = params;
    const request = new Request(API.BASE_URL + API.LOGIN, {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    return fetch(request)
      .then((response) => {
        if (response.status < 200 || response.status >= 300) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then(({ token }) => {
        localStorage.setItem("auth-token", token);
      });
  }

  return Promise.resolve();
};
