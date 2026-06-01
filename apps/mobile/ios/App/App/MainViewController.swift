import UIKit
import Capacitor
import WebKit

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
