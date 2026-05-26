import ExpoModulesCore
import Foundation

#if canImport(FamilyControls)
import FamilyControls
#endif

#if canImport(ManagedSettings)
import ManagedSettings
#endif

public class DecisionLockModule: Module {
  private let configKey = "just_choose_decision_lock_config"
  private let selectedSummaryKey = "just_choose_selected_apps_summary"
  private let activePrefix = "just_choose_decision_lock_active:"

  public func definition() -> ModuleDefinition {
    Name("DecisionLock")

    AsyncFunction("getStatus") { () async -> String in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        switch AuthorizationCenter.shared.authorizationStatus {
        case .notDetermined:
          return "permission_not_requested"
        case .denied:
          return "permission_denied"
        case .approved:
          return "available"
        @unknown default:
          return "error"
        }
      }
      #endif

      return "unsupported"
    }

    AsyncFunction("requestPermission") { () async -> String in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        do {
          try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
          return "available"
        } catch {
          return "permission_denied"
        }
      }
      #endif

      return "unsupported"
    }

    AsyncFunction("openAppSelection") { () -> Void in
      // Production build note:
      // Present FamilyActivityPicker from a SwiftUI view controller here after the
      // Family Controls distribution entitlement is granted. The picker keeps the
      // selected apps private and should only persist the opaque selection tokens.
      UserDefaults.standard.set("FamilyActivityPicker required in entitlement build", forKey: self.selectedSummaryKey)
    }

    AsyncFunction("getSelectedAppsSummary") { () -> String in
      UserDefaults.standard.string(forKey: self.selectedSummaryKey) ?? "No selected distraction apps"
    }

    AsyncFunction("saveConfig") { (config: [String: Any]) -> Void in
      UserDefaults.standard.set(config, forKey: self.configKey)
    }

    AsyncFunction("getConfig") { () -> [String: Any] in
      UserDefaults.standard.dictionary(forKey: self.configKey) ?? [
        "enabled": false,
        "gracePeriodMinutes": 5,
        "maxLockMinutes": 5,
        "maxLocksPerDay": 2,
        "allowedUrgencyLevels": ["in_shop", "before_buying"],
        "allowSnooze": true,
        "snoozeMinutes": 10,
        "allowBypass": true,
        "bypassRequiresReason": false
      ]
    }

    AsyncFunction("startLock") { (input: [String: Any]) -> Void in
      guard let decisionId = input["decisionId"] as? String else {
        return
      }

      UserDefaults.standard.set(input, forKey: "\(self.activePrefix)\(decisionId)")

      #if canImport(ManagedSettings)
      if #available(iOS 16.0, *) {
        // Apply ManagedSettingsStore.shield.applications here after a
        // FamilyActivitySelection has been collected by the device owner.
      }
      #endif
    }

    AsyncFunction("stopLock") { (decisionId: String) -> Void in
      UserDefaults.standard.removeObject(forKey: "\(self.activePrefix)\(decisionId)")

      #if canImport(ManagedSettings)
      if #available(iOS 16.0, *) {
        let store = ManagedSettingsStore()
        store.shield.applications = nil
        store.shield.applicationCategories = nil
      }
      #endif
    }

    AsyncFunction("isLockActive") { (decisionId: String) -> Bool in
      UserDefaults.standard.object(forKey: "\(self.activePrefix)\(decisionId)") != nil
    }
  }
}
