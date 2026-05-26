# Decision Lock Safety and Compliance

## Critical Principle

Decision Lock is consent-based accountability. It is not remote control of another person’s device.

The device owner controls:

- Whether Decision Lock is enabled.
- Which connection can trigger eligible urgent requests.
- Which selected distraction apps can be shielded.
- Which essential apps are never intentionally shielded.
- Grace period, max duration, daily count, and total daily time.
- Quiet hours.
- Snooze, bypass, and full disable controls.

## Mandatory Language

Use:

- Decision Lock
- opt-in
- self-controlled
- temporary
- selected distraction apps
- accountability
- answer or snooze
- always in your control

Avoid coercive, humiliating, punitive, or remote-control framing in code, UI, metadata, and store copy.

## Activation Rules

Decision Lock can only activate when all are true:

- Answering user enabled Decision Lock.
- Answering user chose selected distraction apps or the platform-safe fallback is active.
- Answering user approved this connection as an allowed sender.
- Urgency is eligible: default `in_shop` and `before_buying`; optional `today`; never `no_rush`.
- The decision remains unanswered after the grace period.
- Daily count and total daily time caps have not been reached.
- Quiet hours are inactive unless the user explicitly changes that setting.
- The decision is not muted or snoozed.
- Duration does not exceed the user’s configured max or absolute hard cap.
- Bypass and disable controls remain visible.

## Hard Limits

- Max 3 Decision Locks per day.
- Max 15 minutes per lock.
- Max 30 minutes total shielded time per day.
- No lock chaining.
- No immediate re-run after bypass or snooze.
- No locks during quiet hours by default.
- No locks for `no_rush`.
- No hidden locks.
- No silent background punishment.

## Valid Responses That Stop or Prevent Decision Lock

- I trust your choice
- I don’t mind
- Ask me later
- Can’t answer now
- Call me
- Snooze

## Platform References

- Apple Screen Time Technology Frameworks: https://developer.apple.com/documentation/ScreenTimeAPIDocumentation
- Apple Family Controls framework and entitlement requirement: https://developer.apple.com/documentation/FamilyControls
- Google Play AccessibilityService disclosure and consent: https://support.google.com/googleplay/android-developer/answer/10964491
- Google Play device and network abuse policy: https://support.google.com/googleplay/android-developer/answer/16273414

## Implementation Notes

iOS must use FamilyControls, FamilyActivityPicker, ManagedSettings, and DeviceActivity only when the Family Controls entitlement is granted. The app must not attempt whole-device restrictions.

Android MVP should prefer notifications, in-app lock screen, and soft-lock reminders. Usage Access or AccessibilityService must not be introduced without a separate policy review, prominent disclosure, consent, and store declaration workflow.
