# Just Choose MVP Product Decisions

## Positioning

Just Choose is a private decision app for connected people. One person creates visual decision cards, and the other person gives a quick answer.

Core product line:

> For people tired of "I don't mind."

Store-safe description:

> Just Choose is a private decision app for connected people. Create visual decision cards, compare options, and get quick one-tap answers from your connection.

## MVP Layers

Layer 1 is shared across iOS and Android:

- Supabase auth
- Profile setup with display name, age, and gender
- Connection invite codes
- Manage connection screen with private display names and stop-connection controls
- Decision creation with 2-6 visual options
- One-tap answers and valid non-choice answers
- Results, boards, archive, settings
- Push notifications for new decisions
- Safety/privacy screens

Layer 2 is deferred until after the first public release.

## MVP Completion Gates

- A user can sign up and create a profile.
- Registration captures display name, age, and gender.
- A user can invite someone, and the other person can join.
- A user can give their connection a private display name.
- A creator can create visual decisions with 2-6 options.
- The connected person can answer in one tap or use a valid non-choice answer.
- The creator can see the result and archive the decision.
- New decisions can trigger push notifications.
- Connection access never includes controlling another user's device.
- The app includes privacy, terms, and account deletion entry points.
