export const VALID_RESPONSE_TYPES = ["selected_option", "cant_choose"] as const;

export type ResponseType = (typeof VALID_RESPONSE_TYPES)[number];
export type QuestionType =
  | "pick_one"
  | "rank_options"
  | "yes_no"
  | "worth_the_money"
  | "care_or_decide";
export type Urgency = "no_rush" | "today" | "in_shop" | "before_buying";
export type AnswerStyle =
  | "just_choose"
  | "be_honest"
  | "think_practically"
  | "help_me_feel_confident"
  | "check_the_price";
export type Gender = "woman" | "man" | "non_binary" | "prefer_not_to_say" | "self_describe";

export type Profile = {
  id: string;
  displayName: string;
  profileDisplayName?: string;
  connectionDisplayName?: string | null;
  age?: number | null;
  gender?: Gender | null;
  avatarUrl?: string | null;
  avatarPath?: string | null;
};

export type Connection = {
  id: string;
  inviteCode: string;
  inviteExpiresAt?: string | null;
  createdBy: string;
  billingOwnerUserId?: string | null;
  subscriptionStatus: "inactive" | "trialing" | "active" | "past_due" | "canceled";
  plan: string;
  premiumEnabled: boolean;
  subscriptionCurrentPeriodEnd?: string | null;
  createdAt: string;
};

export type ConnectionRequest = {
  connectionId: string;
  requesterId: string;
  requesterDisplayName: string;
  requestedAt: string;
};

export type ConnectionSummary = {
  connection: Connection;
  connectedProfile: Profile | null;
};

export type DecisionOption = {
  id: string;
  decisionId?: string;
  label: string;
  title?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
  sortOrder: number;
};

export type DecisionStatus = "pending" | "answered";

export type Decision = {
  id: string;
  connectionId: string;
  createdBy: string;
  assignedTo: string;
  title: string;
  note?: string | null;
  status: DecisionStatus;
  createdAt: string;
  updatedAt: string;
  answeredAt?: string | null;
  options: DecisionOption[];
  response?: DecisionResponse | null;
  urgency?: Urgency;
};

export type DecisionResponse = {
  id: string;
  decisionId: string;
  responderId: string;
  selectedOptionId?: string | null;
  responseType: ResponseType;
  comment?: string | null;
  createdAt: string;
};

export type ChoiceOptionInput = {
  label: string;
  title?: string | null;
  imageUrl?: string | null;
  imagePath?: string | null;
};

export type DecisionLockStatus =
  | "unsupported"
  | "permission_not_requested"
  | "permission_denied"
  | "available"
  | "active"
  | "error";

export type DecisionLockConfig = {
  enabled: boolean;
  gracePeriodMinutes: number;
  maxLockMinutes: number;
  maxLocksPerDay: number;
  allowedUrgencyLevels: Array<"in_shop" | "before_buying" | "today">;
  allowSnooze: boolean;
  snoozeMinutes: number;
  allowBypass: boolean;
  bypassRequiresReason: boolean;
};

export type DecisionLockSettings = DecisionLockConfig & {
  userId?: string;
  connectionId?: string;
  allowedConnectedProfileId?: string | null;
  selectedAppsSummary: string;
  maxTotalLockMinutesPerDay: number;
  todayLockCount: number;
  todayTotalLockMinutes: number;
  lastLockAt?: string | null;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  disabledUntil?: string | null;
};

export type StartDecisionLockInput = {
  decisionId: string;
  title: string;
  urgency: Urgency;
  expiresAt: string;
};

export interface DecisionLockModule {
  getStatus(): Promise<DecisionLockStatus>;
  requestPermission(): Promise<DecisionLockStatus>;
  openAppSelection(): Promise<void>;
  getSelectedAppsSummary(): Promise<string>;
  saveConfig(config: DecisionLockConfig): Promise<void>;
  getConfig(): Promise<DecisionLockConfig>;
  startLock(input: StartDecisionLockInput): Promise<void>;
  stopLock(decisionId: string): Promise<void>;
  isLockActive(decisionId: string): Promise<boolean>;
}
