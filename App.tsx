import "react-native-url-polyfill/auto";

import { NavigationContainer } from "@react-navigation/native";
import type { LinkingOptions } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppNavigator } from "./src/navigation/AppNavigator";
import type { RootStackParamList } from "./src/navigation/types";
import { ThemeProvider } from "./src/theme";

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["justchoose://"],
  config: {
    screens: {
      Auth: "auth/callback",
      JoinConnection: "invite/:inviteCode",
    },
  },
};

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="dark" />
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
