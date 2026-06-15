import UIKit
import Capacitor
import WebKit
import HealthKit

/**
 * Custom bridge view controller for the iOS shell.
 *
 * WKWebView fills the whole screen, including the status bar area. The web
 * app's background then reaches the physical top edge, while this injected CSS
 * keeps the header clear of the Dynamic Island without adding a large empty
 * top band.
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SleepHealthPlugin())
        guard let webView = self.bridge?.webView else { return }
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.backgroundColor = UIColor(red: 0.957, green: 0.945, blue: 1.0, alpha: 1.0)
        view.backgroundColor = UIColor(red: 0.957, green: 0.945, blue: 1.0, alpha: 1.0)
        let css = """
        body {
          padding-top: max(24px, calc(env(safe-area-inset-top, 0px) - 24px)) !important;
          padding-bottom: env(safe-area-inset-bottom, 0px) !important;
        }
        """
        let escaped = css.replacingOccurrences(of: "\\", with: "\\\\")
                         .replacingOccurrences(of: "\"", with: "\\\"")
                         .replacingOccurrences(of: "\n", with: " ")
        let js = """
        (function() {
          var style = document.createElement('style');
          style.id = 'native-safe-area';
          style.appendChild(document.createTextNode("\(escaped)"));
          var head = document.head || document.getElementsByTagName('head')[0];
          if (head) head.appendChild(style);
          else document.documentElement.appendChild(style);
        })();
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
    }
}

@objc(SleepHealthPlugin)
public class SleepHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SleepHealthPlugin"
    public let jsName = "SleepHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestSleepPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getRecentSleep", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": HKHealthStore.isHealthDataAvailable(),
            "source": "healthkit",
        ])
    }

    @objc func requestSleepPermission(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.resolve(["granted": false, "status": "unavailable"])
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [sleepType]) { success, error in
            if let error = error {
                call.resolve([
                    "granted": false,
                    "status": "error",
                    "detail": error.localizedDescription,
                ])
                return
            }
            call.resolve([
                "granted": success,
                "status": success ? "available" : "denied",
            ])
        }
    }

    @objc func getRecentSleep(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable(),
              let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            call.resolve(["isSleeping": false, "status": "unavailable", "source": "healthkit"])
            return
        }

        let lookbackHours = max(1, min(call.getInt("lookbackHours") ?? 12, 48))
        let staleMinutes = max(5, min(call.getInt("staleMinutes") ?? 30, 180))
        let now = Date()
        let start = now.addingTimeInterval(TimeInterval(-lookbackHours * 60 * 60))
        let staleCutoff = now.addingTimeInterval(TimeInterval(-staleMinutes * 60))
        let predicate = HKQuery.predicateForSamples(withStart: start, end: now, options: [.strictEndDate])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)

        let query = HKSampleQuery(sampleType: sleepType, predicate: predicate, limit: 20, sortDescriptors: [sort]) { _, samples, error in
            if let error = error {
                call.resolve([
                    "isSleeping": false,
                    "status": "error",
                    "source": "healthkit",
                    "detail": error.localizedDescription,
                ])
                return
            }

            guard let samples = samples as? [HKCategorySample] else {
                call.resolve(["isSleeping": false, "status": "available", "source": "healthkit"])
                return
            }

            let sleepSamples = samples.filter { sample in
                return self.isAsleepValue(sample.value)
            }
            guard let latest = sleepSamples.first else {
                call.resolve(["isSleeping": false, "status": "available", "source": "healthkit"])
                return
            }

            call.resolve([
                "isSleeping": latest.endDate >= staleCutoff,
                "status": "available",
                "source": "healthkit",
                "startedAt": self.iso(latest.startDate),
                "endedAt": self.iso(latest.endDate),
                "stage": self.stageName(latest.value),
            ])
        }
        healthStore.execute(query)
    }

    private func isAsleepValue(_ value: Int) -> Bool {
        if value == HKCategoryValueSleepAnalysis.asleep.rawValue {
            return true
        }
        if #available(iOS 16.0, *) {
            return value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepCore.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue ||
                value == HKCategoryValueSleepAnalysis.asleepREM.rawValue
        }
        return false
    }

    private func stageName(_ value: Int) -> String {
        if value == HKCategoryValueSleepAnalysis.inBed.rawValue { return "in_bed" }
        if value == HKCategoryValueSleepAnalysis.asleep.rawValue { return "asleep" }
        if #available(iOS 16.0, *) {
            if value == HKCategoryValueSleepAnalysis.awake.rawValue { return "awake" }
            if value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue { return "asleep" }
            if value == HKCategoryValueSleepAnalysis.asleepCore.rawValue { return "core" }
            if value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue { return "deep" }
            if value == HKCategoryValueSleepAnalysis.asleepREM.rawValue { return "rem" }
        }
        return "unknown"
    }

    private func iso(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }
}
