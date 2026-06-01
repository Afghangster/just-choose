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
