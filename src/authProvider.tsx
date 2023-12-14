import API from "./lib/API";

export const authProvider = {
  login: ({ username, password }: any) => {
    const request = new Request(API.BASE_URL + API.LOGIN, {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: new Headers({ "Content-Type": "application/json" }),
    });
    return fetch(request)
      .then((response) => {
        if (response.status < 200 || response.status >= 300) {
          console.log(response);
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then(({ token }) => {
        console.log(token);
        localStorage.setItem("auth-token", token);
        return Promise.resolve();
      });
  },
  logout: () => {
    localStorage.removeItem("auth-token");
    return Promise.resolve();
  },
  checkError: ({ status }: any) => {
    if (status === 401 || status === 403) {
      localStorage.removeItem("auth-token");
      return Promise.reject();
    }
    return Promise.resolve();
  },
  checkAuth: () => {
    return localStorage.getItem("auth-token") ? Promise.resolve() : Promise.reject();
  },
  getPermissions: () => Promise.resolve(),
};
