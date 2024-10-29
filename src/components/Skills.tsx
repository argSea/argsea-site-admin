import API from "../lib/API";

export const getSkillChoices = () => {
  // Get skills from the API
  const api = new API();
  const skills = api.get(API.BASE_URL + API.GET_SKILLS);

  // Return the skills
  return skills;
};
