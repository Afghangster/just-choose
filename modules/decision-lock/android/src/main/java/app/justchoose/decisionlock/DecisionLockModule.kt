package app.justchoose.decisionlock

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DecisionLockModule : Module() {
  private val configKey = "just_choose_decision_lock_config"
  private val selectedSummaryKey = "just_choose_selected_apps_summary"
  private val activePrefix = "just_choose_decision_lock_active:"

  override fun definition() = ModuleDefinition {
    Name("DecisionLock")

    AsyncFunction("getStatus") {
      "available"
    }

    AsyncFunction("requestPermission") {
      "available"
    }

    AsyncFunction("openAppSelection") {
      prefs().edit()
        .putString(selectedSummaryKey, "Android soft-lock fallback; no third-party app shielding")
        .apply()
    }

    AsyncFunction("getSelectedAppsSummary") {
      prefs().getString(
        selectedSummaryKey,
        "Android soft-lock fallback; no third-party app shielding"
      ) ?: "Android soft-lock fallback; no third-party app shielding"
    }

    AsyncFunction("saveConfig") { config: Map<String, Any> ->
      prefs().edit().putString(configKey, config.toString()).apply()
    }

    AsyncFunction("getConfig") {
      mapOf(
        "enabled" to false,
        "gracePeriodMinutes" to 5,
        "maxLockMinutes" to 5,
        "maxLocksPerDay" to 2,
        "allowedUrgencyLevels" to listOf("in_shop", "before_buying"),
        "allowSnooze" to true,
        "snoozeMinutes" to 10,
        "allowBypass" to true,
        "bypassRequiresReason" to false
      )
    }

    AsyncFunction("startLock") { input: Map<String, Any> ->
      val decisionId = input["decisionId"] as? String ?: return@AsyncFunction
      prefs().edit().putString("$activePrefix$decisionId", input.toString()).apply()
    }

    AsyncFunction("stopLock") { decisionId: String ->
      prefs().edit().remove("$activePrefix$decisionId").apply()
    }

    AsyncFunction("isLockActive") { decisionId: String ->
      prefs().contains("$activePrefix$decisionId")
    }
  }

  private fun prefs() =
    requireNotNull(appContext.reactContext)
      .getSharedPreferences("just_choose_decision_lock", Context.MODE_PRIVATE)
}
