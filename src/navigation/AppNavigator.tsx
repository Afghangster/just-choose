import { createNativeStackNavigator } from "@react-navigation/native-stack";

import {
  AnswerDecisionScreen,
  AuthScreen,
  CheckEmailScreen,
  ConnectionRequestScreen,
  ConnectionInviteScreen,
  CreateDecisionScreen,
  CreateProfileScreen,
  DecisionDetailScreen,
  DecisionResultScreen,
  DeleteAccountScreen,
  HistoryScreen,
  SavedScreen,
  HomeScreen,
  JoinConnectionScreen,
  MyPeopleScreen,
  ProfileScreen,
  NotificationsScreen,
  SafetyPrivacyScreen,
  SettingsScreen,
  SupportScreen,
  ThemeSelectionScreen,
  SplashScreen,
} from "../screens/AppScreens";
import { useTheme } from "../theme";
import type { RootStackParamList } from "./types";


const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: true,
        headerTintColor: colors.ink,
        headerTitleStyle: { color: colors.ink, fontWeight: "900" },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CheckEmail" component={CheckEmailScreen} options={{ title: "Check email" }} />
      <Stack.Screen name="CreateProfile" component={CreateProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="ConnectionInvite" component={ConnectionInviteScreen} options={{ title: "Invite" }} />
      <Stack.Screen name="JoinConnection" component={JoinConnectionScreen} options={{ title: "Join" }} />
      <Stack.Screen name="ConnectionRequest" component={ConnectionRequestScreen} options={{ title: "Connection request" }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Saved" component={SavedScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateDecision" component={CreateDecisionScreen} options={{ title: "Create" }} />
      <Stack.Screen name="DecisionDetail" component={DecisionDetailScreen} options={{ title: "Choice" }} />
      <Stack.Screen name="AnswerDecision" component={AnswerDecisionScreen} options={{ title: "Answer" }} />
      <Stack.Screen name="DecisionResult" component={DecisionResultScreen} options={{ title: "Result" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: "Notifications" }} />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: "Delete account" }} />
      <Stack.Screen name="Support" component={SupportScreen} options={{ title: "Support" }} />
      <Stack.Screen name="SafetyPrivacy" component={SafetyPrivacyScreen} options={{ title: "Privacy" }} />
      <Stack.Screen name="MyPeople" component={MyPeopleScreen} options={{ title: "My people" }} />
      <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} options={{ title: "App Theme" }} />
    </Stack.Navigator>
  );
}
