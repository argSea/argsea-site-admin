import simpleRestProvider from "ra-data-simple-rest";
import { DataProvider, withLifecycleCallbacks } from "react-admin";

const dataProvider = withLifecycleCallbacks(
  simpleRestProvider("https://api.argsea.com/1"),
  [
    {
      // apply to all resources
      resource: "user",
      beforeSave: async (params: any, dataProvider: DataProvider) => {
        console.log(params);
        // convert pictures to base64
        const newPicture = params.picture.rawFile as File;
        const base64Picture = await convertFileToBase64(newPicture);

        return {
          ...params,
          picture: {
            alt: params.picture.alt,
            src: base64Picture,
          },
        };
      },
    },
  ]
);

const convertFileToBase64 = (file: File) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });

export default dataProvider;
