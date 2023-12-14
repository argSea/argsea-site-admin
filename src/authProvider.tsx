import API from "./lib/API";

export const authProvider = {
  login: ({ username, password }: any) => {
    const request = new Request(API.BASE_URL + API.LOGIN, {
      method: "POST",
      body: JSON.stringify({ username, password }),
      headers: new Headers({ "Content-Type": "application/json" }),
      credentials: "include",
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
        return Promise.resolve();
      });
  },
  logout: () => {
    // remove auth-token cookie
    const request = new Request(API.BASE_URL + API.LOGOUT, {
      method: "GET",
      headers: new Headers({ "Content-Type": "application/json" }),
      credentials: "include",
    });

    fetch(request).then((response) => {
      if (response.status < 200 || response.status >= 300) {
        console.log(response);
        throw new Error(response.statusText);
      }
    });

    return Promise.resolve();
  },
  checkError: ({ status }: any) => {
    if (status === 401 || status === 403) {
      // logout
      return Promise.reject();
    }
    return Promise.resolve();
  },
  checkAuth: () => {
    const request = new Request(API.BASE_URL + API.VALIDATE, {
      method: "GET",
      headers: new Headers({ "Content-Type": "application/json" }),
      credentials: "include",
    });
    return fetch(request).then((response) => {
      if (response.status < 200 || response.status >= 300) {
        console.log(response);
        throw new Error(response.statusText);
      }

      return Promise.resolve();
    });
  },
  getPermissions: () => Promise.resolve(),
};
