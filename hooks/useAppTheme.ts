import { MD3LightTheme } from "react-native-paper";

export function useAppTheme() {
  const appTheme = {
    ...MD3LightTheme,
    colors: {
      ...MD3LightTheme.colors,
      primary: "#53B175",
      secondary: "#F3F4F6",
    },
    roundness: 2,
  };

  return appTheme;
}
