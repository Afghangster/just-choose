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
  SafetyPrivacy: undefined;
  ManageConnections: undefined;
  LeaveConnectionConfirm: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
