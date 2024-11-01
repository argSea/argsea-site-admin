import simpleRestProvider from "ra-data-simple-rest";
import { fetchUtils, withLifecycleCallbacks } from "react-admin";

// add credentials include to all requests
const httpClient = (url: string, options: any = {}) => {
  if (!options.headers) {
    options.headers = new Headers({ Accept: "application/json" });
  }

  // add your own headers here
  options.credentials = "include";
  options.headers.set("Content-Type", "application/json");

  return fetchUtils.fetchJson(url, options);
};

const dataProvider = withLifecycleCallbacks(
  simpleRestProvider("https://api.argsea.com/1", httpClient, "X-Total-Count"),
  [
    {
      // apply to user resources
      resource: "user",
      beforeSave: async (params: any) => {
        console.log(params);
        // pictures can be in params.picture, params.contacts[0].icon, params.techInterests[0].icon, check if any of them is a File
        let newPictures = params.pictures;
        let newContacts = params.contacts;
        let newTechInterests = params.techInterests;

        // conver param.pictures to base64
        if (params.pictures) {
          newPictures = await convertImages(params.pictures);
        }

        if (params.contacts) {
          newContacts = await convertContacts(params.contacts);
          console.log(newContacts);
        }
        
        if (params.techInterests) {
          newTechInterests = await convertTechInterests(params.techInterests);
        }

        return {
          ...params,
          contacts: await newContacts,
          pictures: await newPictures,
          techInterests: await newTechInterests,
        };
      },
    },
    {
      resource: "project",
      beforeSave: async (params: any) => {
        console.log(params);
        let newIcon = params.icon;
        let newImages = params.images;

        if (params.icon && params.icon.rawFile) {
          newIcon = await convertPicture(params.icon);
        }

        if (params.images) {
          newImages = await convertImages(params.images);
        }

        // update updateDate to now
        params.updateDate = new Date().toISOString();

        return {
          ...params,
          icon: await newIcon,
          images: await newImages,
        };
      },
    },
    {
      resource: "skill",
      beforeSave: async (params: any) => {
        console.log(params);

        return {
          ...params,
        };
      },
    }
  ]
);

const convertImages = async (images: any) => {
  console.log(images);
  // for loop
  for (let i = 0; i < images.length; i++) {
    if (images[i].image && images[i].image.rawFile) {
      images[i].image = await convertPicture(images[i].image);
    }
  }

  return images;
}

const convertContacts = async (contacts: any) => {
  console.log(contacts);
  // for loop
  for (let i = 0; i < contacts.length; i++) {
    if (contacts[i].icon && contacts[i].icon.rawFile) {
      contacts[i].icon = await convertPicture(contacts[i].icon);
    }
  }

  return contacts;
}

const convertTechInterests = async (techInterests: any) => {
  console.log(techInterests);
  // for loop
  for (let i = 0; i < techInterests.length; i++) {
    if (techInterests[i].icon && techInterests[i].icon.rawFile) {
      techInterests[i].icon = await convertPicture(techInterests[i].icon);
    }
  }

  return techInterests;
}

const convertPicture = async (picture: any) => {
  if (!picture.rawFile) {
    return picture;
  }

  const newPicture = picture.rawFile as File;
  const base64Picture = await convertFileToBase64(newPicture);
  return {
    ...picture,
      src: base64Picture,
  };
}

const convertFileToBase64 = (file: File) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });

export default dataProvider;
