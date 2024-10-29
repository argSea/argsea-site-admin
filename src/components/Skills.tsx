import API from "../lib/API";

export const getSkillChoices = async () => {
  // Get skills from the API
  const skills = new Request(API.BASE_URL + API.GET_SKILLS, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return fetch(skills).then((response) => {
    if (response.status < 200 || response.status >= 300) {
      console.log(response);
      throw new Error(response.statusText);
    }
    return response.json();
  });
};
