import UIKit
import Capacitor
import WebKit

/**
 * Custom bridge view controller that injects a CSS userscript so the web
 * app respects the device safe-area insets (status bar + dynamic island +
 * home indicator). We do this in the native shell rather than in the web
 * frontend so the same Next.js app keeps rendering normally in browsers.
 *
 * Injecting at .atDocumentStart guarantees the CSS lands before the page's
 * own styles compute layout, so there's no flash of unstyled status bar.
 */
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        guard let webView = self.bridge?.webView else { return }
        let css = """
        :root { --capacitor-safe-area-top: env(safe-area-inset-top, 0px); --capacitor-safe-area-bottom: env(safe-area-inset-bottom, 0px); }
        html { box-sizing: border-box; }
        body { padding-top: env(safe-area-inset-top, 0px) !important; padding-bottom: env(safe-area-inset-bottom, 0px) !important; }
        @supports (padding-top: env(safe-area-inset-top)) { body { padding-top: env(safe-area-inset-top) !important; } }
        """
        // JS injects the style into <head> as soon as the document begins parsing.
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
