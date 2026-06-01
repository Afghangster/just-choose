export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  CheckEmail: { email: string };
  CreateProfile: undefined;
  ConnectionInvite: undefined;
  JoinConnection: { inviteCode?: string } | undefined;
  ConnectionRequest: { requesterId: string };
  Home: undefined;
  History: undefined;
  Saved: undefined;
  CreateDecision: undefined;
  DecisionDetail: { decisionId: string };
  AnswerDecision: { decisionId: string };
  DecisionResult: { decisionId: string };
  Settings: undefined;
  Profile: undefined;
  Notifications: undefined;
  DeleteAccount: undefined;
  Support: undefined;
  SafetyPrivacy: undefined;
  MyPeople: undefined;
  ThemeSelection: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
