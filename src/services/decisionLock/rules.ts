import type {
  Decision,
  DecisionLockConfig,
  DecisionLockSettings,
  Urgency,
} from "../../types/domain";

export const ABSOLUTE_MAX_LOCKS_PER_DAY = 3;
export const ABSOLUTE_MAX_LOCK_MINUTES = 15;
export const ABSOLUTE_MAX_TOTAL_LOCK_MINUTES_PER_DAY = 30;

export const DEFAULT_DECISION_LOCK_CONFIG: DecisionLockConfig = {
  enabled: false,
  gracePeriodMinutes: 5,
  maxLockMinutes: 5,
  maxLocksPerDay: 2,
  allowedUrgencyLevels: ["in_shop", "before_buying"],
  allowSnooze: true,
  snoozeMinutes: 10,
  allowBypass: true,
  bypassRequiresReason: false,
};

export const DEFAULT_DECISION_LOCK_SETTINGS: DecisionLockSettings = {
  ...DEFAULT_DECISION_LOCK_CONFIG,
  allowedConnectedProfileId: null,
  selectedAppsSummary: "No selected distraction apps",
  maxTotalLockMinutesPerDay: 15,
  todayLockCount: 0,
  todayTotalLockMinutes: 0,
  lastLockAt: null,
  quietHoursEnabled: true,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  disabledUntil: null,
};

export type DecisionLockEligibilityContext = {
  settings: DecisionLockSettings;
  decision: Pick<
    Decision,
    | "urgency"
    | "assignedTo"
    | "createdBy"
    | "status"
    | "createdAt"
    | "answeredAt"
  >;
  now?: Date;
  mutedOrSnoozed?: boolean;
};

export type DecisionLockEligibilityResult = {
  allowed: boolean;
  reason: string;
};

export function clampDecisionLockConfig(config: DecisionLockConfig): DecisionLockConfig {
  return {
    ...config,
    gracePeriodMinutes: Math.max(0, config.gracePeriodMinutes),
    maxLockMinutes: Math.min(
      ABSOLUTE_MAX_LOCK_MINUTES,
      Math.max(1, config.maxLockMinutes),
    ),
    maxLocksPerDay: Math.min(
      ABSOLUTE_MAX_LOCKS_PER_DAY,
      Math.max(0, config.maxLocksPerDay),
    ),
    snoozeMinutes: Math.max(1, config.snoozeMinutes),
  };
}

export function isDecisionLockUrgency(urgency: Urgency) {
  return urgency === "today" || urgency === "in_shop" || urgency === "before_buying";
}

export function isInQuietHours(now: Date, start: string, end: string) {
  const current = now.getHours() * 60 + now.getMinutes();
  const startMinutes = parseClock(start);
  const endMinutes = parseClock(end);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return current >= startMinutes && current < endMinutes;
  }

  return current >= startMinutes || current < endMinutes;
}

export function evaluateDecisionLockEligibility({
  settings,
  decision,
  now = new Date(),
  mutedOrSnoozed = false,
}: DecisionLockEligibilityContext): DecisionLockEligibilityResult {
  if (!settings.enabled) {
    return { allowed: false, reason: "Decision Lock is off." };
  }

  if (settings.disabledUntil && new Date(settings.disabledUntil) > now) {
    return { allowed: false, reason: "Decision Lock is off for today." };
  }

  if (!settings.selectedAppsSummary || settings.selectedAppsSummary.startsWith("No ")) {
    return {
      allowed: false,
      reason: "Choose selected distraction apps before Decision Lock can run.",
    };
  }

  if (!settings.allowedConnectedProfileId || settings.allowedConnectedProfileId !== decision.createdBy) {
    return {
      allowed: false,
      reason: "This connection is not approved for Decision Lock nudges.",
    };
  }

  if (decision.status !== "pending" || decision.answeredAt) {
    return { allowed: false, reason: "This decision already has a valid answer." };
  }

  if (decision.urgency === "no_rush") {
    return { allowed: false, reason: "No rush decisions are never eligible." };
  }

  if (!settings.allowedUrgencyLevels.includes(decision.urgency as never)) {
    return {
      allowed: false,
      reason: "This urgency level is not enabled for Decision Lock.",
    };
  }

  if (mutedOrSnoozed) {
    return {
      allowed: false,
      reason: "This decision is snoozed or muted.",
    };
  }

  if (settings.quietHoursEnabled) {
    const quiet = isInQuietHours(now, settings.quietHoursStart, settings.quietHoursEnd);
    if (quiet) {
      return {
        allowed: false,
        reason: "Quiet hours are active.",
      };
    }
  }

  if (settings.todayLockCount >= Math.min(settings.maxLocksPerDay, ABSOLUTE_MAX_LOCKS_PER_DAY)) {
    return {
      allowed: false,
      reason: "Daily Decision Lock limit reached.",
    };
  }

  if (settings.todayTotalLockMinutes >= ABSOLUTE_MAX_TOTAL_LOCK_MINUTES_PER_DAY) {
    return {
      allowed: false,
      reason: "Daily shielded-time limit reached.",
    };
  }

  const createdAt = new Date(decision.createdAt);
  const graceEndsAt = new Date(
    createdAt.getTime() + settings.gracePeriodMinutes * 60 * 1000,
  );

  if (graceEndsAt > now) {
    return {
      allowed: false,
      reason: "Grace period is still active.",
    };
  }

  return { allowed: true, reason: "Decision Lock may start under this user's rules." };
}

function parseClock(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}
