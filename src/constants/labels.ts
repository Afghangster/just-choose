import type { AnswerStyle, QuestionType, ResponseType, Urgency } from "../types/domain";

export const questionTypeLabels: Record<QuestionType, string> = {
  pick_one: "Pick one",
  rank_options: "Rank options",
  yes_no: "Yes / No",
  worth_the_money: "Worth the money?",
  care_or_decide: "Do you care or shall I decide?",
};

export const urgencyLabels: Record<Urgency, string> = {
  no_rush: "No rush",
  today: "Today",
  in_shop: "I’m in the shop",
  before_buying: "Need answer before I buy",
};

export const answerStyleLabels: Record<AnswerStyle, string> = {
  just_choose: "Just choose",
  be_honest: "Be honest",
  think_practically: "Think practically",
  help_me_feel_confident: "Help me feel confident",
  check_the_price: "Check the price",
};

export const responseTypeLabels: Partial<Record<ResponseType | string, string>> = {
  selected_option: "Selected an option",
  cant_choose: "Could not choose",
  ranked_options: "Ranked the options",
  yes: "Yes",
  no: "No",
  worth_it: "Worth it",
  not_worth_it: "Not worth it",
  i_trust_you: "I trust your choice",
  i_dont_mind: "I don’t mind",
  ask_me_later: "Ask me later",
  cant_answer_now: "Can’t answer now",
  call_me: "Call me",
  comment_only: "Comment only",
};

export const nudgeCopy = [
  "Just choose. It’ll take five seconds.",
  "A verdict is needed.",
  "They’re waiting for your excellent taste.",
  "Tiny decision. Big suspense.",
  "Tap once and be helpful.",
  "They’re in the shop. This is not a drill.",
  "Your connection needs a quick answer.",
];

export const decisionLockCopy = {
  title: "Decision Lock",
  subtitle:
    "Let Just Choose temporarily shield selected distraction apps when you ignore urgent decisions from your connection.",
  disclosure:
    "Decision Lock is optional. You control whether it is on, which apps can be shielded, how long it lasts, and when it can happen. Your connection cannot directly control your phone.",
  permission:
    "Just Choose needs permission to shield selected apps that you choose. This is used only for your own Decision Lock settings. Your connection cannot choose your blocked apps, change your limits, or block your phone directly.",
  activeTitle: "Quick verdict needed",
  activeBody:
    "You chose to shield distractions until you answer this urgent decision or snooze it.",
  connectedProfileUrgentHint: "This may trigger their Decision Lock if they have enabled it.",
  connectedProfileNudgeHint: "If they have opted in, Just Choose may nudge them more strongly.",
};
