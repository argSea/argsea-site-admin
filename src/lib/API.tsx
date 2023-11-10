class API {
  static BASE_URL = "https://api.argsea.com/1";

  static GET_USER = "/user/{id}/";
  static GET_USER_PROJECTS = "/user/{id}/projects/";
  static GET_USER_RESUME = "/user/{id}/resume/";

  static PUT_USER = "/user/{id}/";

  static LOGIN = "/auth/login/";
  static VALIDATE = "/auth/validate/";
  static LOGOUT = "/auth/logout/";
  constructor() {}

  async get(url: string) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  }

  async post(url: string, data: any) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.json();
  }
}

export default API;
