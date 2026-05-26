# Just Choose MVP Product Decisions

## Positioning

Just Choose is a private decision app for connected people. One person creates visual decision cards, and the other person gives a quick answer.

Core product line:

> For people tired of "I don't mind."

Store-safe description:

> Just Choose is a private decision app for connected people. Create visual decision cards, compare options, and get quick one-tap answers from your connection. For urgent choices, optional Decision Lock lets a user temporarily shield selected distraction apps they choose, under their own limits, to help them respond faster. Your connection cannot directly control your phone.

## MVP Layers

Layer 1 is shared across iOS and Android:

- Supabase auth
- Profile setup with display name, age, and gender
- Connection invite codes
- Manage connection screen with private display names and stop-connection controls
- Decision creation with 2-6 visual options
- One-tap answers and valid non-choice answers
- Results, boards, archive, settings
- Push notifications and nudge reminders
- Safety/privacy screens

Layer 2 is platform-specific Decision Lock:

- iOS: use Screen Time APIs only in builds with the approved Family Controls entitlement.
- Android: MVP defaults to persistent notifications, in-app lock screen, and soft-lock reminders unless a stricter implementation is reviewed and policy-safe.

## Decision Lock Product Rule

The product must always be able to honestly say:

> Your connection cannot block your phone. You can choose to temporarily shield selected distractions when you ignore urgent decisions from your connection.

Connection-side urgent copy:

> This may trigger their Decision Lock if they have enabled it.

Softer connection-side copy:

> If they have opted in, Just Choose may nudge them more strongly.

## MVP Completion Gates

- A user can sign up and create a profile.
- Registration captures display name, age, and gender.
- A user can invite someone, and the other person can join.
- A user can give their connection a private display name.
- A creator can create visual decisions with 2-6 options.
- The connected person can answer in one tap or use a valid non-choice answer.
- The creator can see the result and archive the decision.
- Urgent decisions schedule push/nudge notifications.
- The answering user can configure Decision Lock limits, quiet hours, selected distraction apps where supported, and an allowed connection.
- Decision Lock gracefully degrades when platform permissions are unavailable.
- Connection access never includes editing another user’s Decision Lock settings.
- The app includes privacy, terms, and account deletion entry points.
