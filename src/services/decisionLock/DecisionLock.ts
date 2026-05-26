import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireNativeModule } from "expo";
import { Platform } from "react-native";

import type {
  DecisionLockConfig,
  DecisionLockModule,
  DecisionLockStatus,
  StartDecisionLockInput,
} from "../../types/domain";
import { DEFAULT_DECISION_LOCK_CONFIG, clampDecisionLockConfig } from "./rules";

const CONFIG_KEY = "just_choose_decision_lock_config";
const ACTIVE_KEY_PREFIX = "just_choose_decision_lock_active:";

let nativeDecisionLock: DecisionLockModule | null = null;

try {
  nativeDecisionLock = requireNativeModule<DecisionLockModule>("DecisionLock");
} catch {
  nativeDecisionLock = null;
}

const fallbackDecisionLock: DecisionLockModule = {
  async getStatus(): Promise<DecisionLockStatus> {
    if (Platform.OS === "android") {
      return "available";
    }

    if (Platform.OS === "ios") {
      return "unsupported";
    }

    return "unsupported";
  },

  async requestPermission(): Promise<DecisionLockStatus> {
    if (Platform.OS === "android") {
      return "available";
    }

    return "unsupported";
  },

  async openAppSelection(): Promise<void> {
    await AsyncStorage.setItem(
      "just_choose_selected_apps_summary",
      Platform.OS === "android"
        ? "Android soft-lock fallback; no third-party app shielding"
        : "Family Controls entitlement build required",
    );
  },

  async getSelectedAppsSummary(): Promise<string> {
    const stored = await AsyncStorage.getItem("just_choose_selected_apps_summary");
    if (stored) {
      return stored;
    }

    return Platform.OS === "android"
      ? "Android soft-lock fallback; no third-party app shielding"
      : "No selected distraction apps";
  },

  async saveConfig(config: DecisionLockConfig): Promise<void> {
    await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(clampDecisionLockConfig(config)));
  },

  async getConfig(): Promise<DecisionLockConfig> {
    const stored = await AsyncStorage.getItem(CONFIG_KEY);
    if (!stored) {
      return DEFAULT_DECISION_LOCK_CONFIG;
    }

    return clampDecisionLockConfig({
      ...DEFAULT_DECISION_LOCK_CONFIG,
      ...JSON.parse(stored),
    });
  },

  async startLock(input: StartDecisionLockInput): Promise<void> {
    await AsyncStorage.setItem(
      `${ACTIVE_KEY_PREFIX}${input.decisionId}`,
      JSON.stringify({ ...input, startedAt: new Date().toISOString() }),
    );
  },

  async stopLock(decisionId: string): Promise<void> {
    await AsyncStorage.removeItem(`${ACTIVE_KEY_PREFIX}${decisionId}`);
  },

  async isLockActive(decisionId: string): Promise<boolean> {
    const stored = await AsyncStorage.getItem(`${ACTIVE_KEY_PREFIX}${decisionId}`);
    return Boolean(stored);
  },
};

export const DecisionLock = nativeDecisionLock ?? fallbackDecisionLock;
