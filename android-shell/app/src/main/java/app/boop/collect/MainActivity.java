package app.boop.collect;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.browser.customtabs.CustomTabsIntent;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import androidx.webkit.WebViewCompat.WebMessageListener;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.JavaScriptReplyProxy;

import org.json.JSONObject;
import java.util.Collections;

/**
 * A real native Android toolbar and five-tab navigation surrounding Boop's
 * online game view. AI combining, cloud profiles and image generation are
 * served live from the HTTPS Worker. No game logic or image API keys in APK.
 */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://coco-kemon.logaandavid.workers.dev";
    private static final String START_URL = ORIGIN + "/?boop_android=1";
    private static final String AUTH_SCHEME = "boop";
    private static final String AUTH_HOST = "oauth-callback";
    private static final int FOREST = Color.rgb(42, 48, 56);
    private static final int INK = Color.rgb(30, 35, 42);
    private static final int MUTED = Color.rgb(112, 120, 129);
    private static final int PALE = Color.rgb(249, 250, 252);
    private static final String[][] TABS = {
        {"kitchen", "Kitchen", "♨"},
        {"infinite-craft", "Craft", "⚗"},
        {"foundry", "Foundry", "◇"},
        {"archive", "Collection", "▦"},
        {"sprite-lab", "Sprites", "✦"},
        {"profile", "Profile", "☻"}
    };

    private WebView webView;
    private FrameLayout webFrame;
    private ProgressBar progressBar;
    private TextView[] tabViews;
    private String selectedTab = "infinite-craft";
    private ValueCallback<Uri[]> fileUploadCallback;
    private static final int FILE_CHOOSE_CODE = 4312;
    private String pendingOAuthCode;
    private long lastBackMillis = 0L;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.rgb(255, 255, 255));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        Uri incoming = getIntent() == null ? null : getIntent().getData();
        if (isOAuthCallback(incoming)) pendingOAuthCode = incoming.getQueryParameter("code");

        LinearLayout screen = new LinearLayout(this);
        screen.setOrientation(LinearLayout.VERTICAL);
        screen.setBackgroundColor(Color.WHITE);
        setContentView(screen);

        // Android 15 enforces edge-to-edge for target SDK 35: native controls
        // must stay out of the status and gesture-navigation system bars.
        if (Build.VERSION.SDK_INT >= 35) {
            screen.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                view.setPadding(0, bars.top, 0, bars.bottom);
                return insets;
            });
            screen.requestApplyInsets();
        }

        screen.addView(buildToolbar(), new LinearLayout.LayoutParams(-1, dp(57)));
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setIndeterminate(true);
        progressBar.setVisibility(View.GONE);
        screen.addView(progressBar, new LinearLayout.LayoutParams(-1, dp(3)));

        webFrame = new FrameLayout(this);
        screen.addView(webFrame, new LinearLayout.LayoutParams(-1, 0, 1));
        createWebView();

        screen.addView(buildBottomNav(), new LinearLayout.LayoutParams(-1, dp(73)));
        selectTabVisual(selectedTab);
        webView.loadUrl(urlForOAuthCode(pendingOAuthCode));
    }

    private LinearLayout buildToolbar() {
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(16), 0, dp(12), 0);
        toolbar.setBackgroundColor(Color.WHITE);

        TextView icon = new TextView(this);
        icon.setText("✿");
        icon.setTextSize(25);
        icon.setTextColor(PALE);
        icon.setGravity(Gravity.CENTER);
        icon.setBackground(roundRect(FOREST, 13, 0));
        toolbar.addView(icon, new LinearLayout.LayoutParams(dp(39), dp(39)));

        TextView title = new TextView(this);
        title.setText("Boop");
        title.setTextSize(23);
        title.setTextColor(INK);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0, -1, 1);
        titleParams.leftMargin = dp(10);
        toolbar.addView(title, titleParams);

        TextView refresh = toolbarButton("↻", "Refresh Boop");
        refresh.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
            webView.reload();
        });
        toolbar.addView(refresh, new LinearLayout.LayoutParams(dp(42), dp(42)));

        TextView profile = toolbarButton("☻", "Cloud saves and profile");
        profile.setOnClickListener(v -> {
            v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
            sendWebEvent("boop-native-profile", "");
        });
        LinearLayout.LayoutParams profileParams = new LinearLayout.LayoutParams(dp(42), dp(42));
        profileParams.leftMargin = dp(3);
        toolbar.addView(profile, profileParams);
        return toolbar;
    }

    private TextView toolbarButton(String label, String contentDescription) {
        TextView button = new TextView(this);
        button.setText(label);
        button.setTextSize(26);
        button.setGravity(Gravity.CENTER);
        button.setTextColor(FOREST);
        button.setContentDescription(contentDescription);
        button.setClickable(true);
        button.setFocusable(true);
        button.setBackground(roundRect(Color.rgb(246, 247, 249), 13, 0));
        return button;
    }

    private LinearLayout buildBottomNav() {
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER);
        bar.setPadding(dp(5), dp(7), dp(5), dp(6));
        bar.setBackgroundColor(Color.WHITE);
        bar.setElevation(dp(9));
        tabViews = new TextView[TABS.length];
        for (int i = 0; i < TABS.length; i++) {
            final int index = i;
            TextView item = new TextView(this);
            item.setGravity(Gravity.CENTER);
            item.setTextSize(12);
            item.setIncludeFontPadding(false);
            item.setText(TABS[i][2] + "\n" + TABS[i][1]);
            item.setContentDescription(TABS[i][1]);
            item.setClickable(true);
            item.setFocusable(true);
            item.setOnClickListener(v -> {
                v.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP);
                final String chosen = TABS[index][0];
                selectTabVisual(chosen);
                sendWebEvent("boop-native-tab", chosen);
            });
            bar.addView(item, new LinearLayout.LayoutParams(0, -1, 1));
            tabViews[i] = item;
        }
        return bar;
    }

    private void selectTabVisual(String tab) {
        selectedTab = tab;
        if (tabViews == null) return;
        for (int i = 0; i < TABS.length; i++) {
            boolean active = TABS[i][0].equals(tab) || ("notebook".equals(tab) && "archive".equals(TABS[i][0]));
            TextView item = tabViews[i];
            item.setTypeface(Typeface.DEFAULT, active ? Typeface.BOLD : Typeface.NORMAL);
            item.setTextColor(active ? FOREST : MUTED);
            item.setBackground(roundRect(active ? PALE : Color.TRANSPARENT, 13, 0));
            item.setSelected(active);
        }
    }

    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " BoopAndroid/2");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Only the trusted game origin can send commands to the native shell.
        // Using origin-scoped WebMessage avoids an unrestricted JS interface.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "BoopNative",
                Collections.singleton(ORIGIN), (view, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame || !ORIGIN.equals(sourceOrigin.toString())) return;
                    String raw = message.getData();
                    if (raw == null || raw.length() > 4096) return;
                    runOnUiThread(() -> handleWebMessage(raw));
                });
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int progress) {
                if (progressBar == null) return;
                progressBar.setProgress(progress);
                progressBar.setVisibility(progress < 100 ? View.VISIBLE : View.GONE);
            }
            @Override public boolean onShowFileChooser(WebView view,
                ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileUploadCallback != null) fileUploadCallback.onReceiveValue(null);
                fileUploadCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSE_CODE);
                    return true;
                } catch (Exception error) {
                    fileUploadCallback = null;
                    return false;
                }
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("Confirm", (dialog, which) -> result.confirm())
                    .setNegativeButton("Cancel", (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel()).show();
                return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.confirm()).show();
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if (isGameUrl(url)) return false;
                // Never embed Google OAuth or arbitrary third-party sites in
                // WebView. External links open with the real browser.
                if ("https".equals(url.getScheme())) {
                    openBrowser(url);
                    return true;
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (isGameUrl(Uri.parse(url))) {
                    // Web renderer is online; native controls do not depend on
                    // the web site's original header or bottom navigation.
                    view.evaluateJavascript("document.documentElement.classList.add('boop-native-shell')", null);
                }
            }
        });
        webFrame.addView(webView, new FrameLayout.LayoutParams(-1, -1));
    }

    private void handleWebMessage(String raw) {
        try {
            JSONObject data = new JSONObject(raw);
            String type = data.optString("type", "");
            if ("tab".equals(type)) {
                String tab = data.optString("tab");
                if (isAllowedTab(tab)) selectTabVisual(tab);
            } else if ("oauth".equals(type)) {
                Uri url = Uri.parse(data.optString("url", ""));
                // Supabase project's own OAuth initiation endpoint only.
                if ("https".equals(url.getScheme()) &&
                    "lrjszbguvqgdsqvvcoqe.supabase.co".equals(url.getHost()) &&
                    url.getPath() != null && url.getPath().startsWith("/auth/v1/authorize")) {
                    openBrowser(url);
                } else {
                    Toast.makeText(this, "Google sign-in URL was not trusted", Toast.LENGTH_LONG).show();
                }
            }
        } catch (Exception ignored) { /* Ignore malformed/untrusted UI events. */ }
    }

    private boolean isAllowedTab(String tab) {
        for (String[] t : TABS) if (t[0].equals(tab)) return true;
        return "notebook".equals(tab);
    }

    private void sendWebEvent(String type, String detail) {
        if (webView == null) return;
        String argument = JSONObject.quote(detail);
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent(" +
            JSONObject.quote(type) + ",{detail:" + argument + "}));", null);
    }

    private void openBrowser(Uri url) {
        try {
            new CustomTabsIntent.Builder().setShowTitle(true).setToolbarColor(FOREST)
                .build().launchUrl(this, url);
        } catch (Exception error) {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        }
    }

    private static boolean isGameUrl(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) &&
            "coco-kemon.logaandavid.workers.dev".equals(uri.getHost());
    }

    private static boolean isOAuthCallback(Uri uri) {
        return uri != null && AUTH_SCHEME.equals(uri.getScheme()) &&
            AUTH_HOST.equals(uri.getHost()) &&
            uri.getQueryParameter("code") != null &&
            uri.getQueryParameter("code").length() <= 2048;
    }

    private String urlForOAuthCode(String code) {
        if (code == null || code.isEmpty()) return START_URL;
        return START_URL + "&code=" + Uri.encode(code);
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (isOAuthCallback(intent.getData())) {
            String code = intent.getData().getQueryParameter("code");
            if (webView != null) webView.loadUrl(urlForOAuthCode(code));
            else pendingOAuthCode = code;
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSE_CODE && fileUploadCallback != null) {
            fileUploadCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileUploadCallback = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView == null) { super.onBackPressed(); return; }
        // Let Boop close its own open modals first; otherwise go back to Craft.
        webView.evaluateJavascript("(function(){var m=document.querySelector('dialog[open], .fixed.inset-0.z-50');" +
            "if(m){window.dispatchEvent(new Event('boop-native-back'));return 'modal'}return 'none'})()", response -> {
            if ("\"modal\"".equals(response)) return;
            if (!"infinite-craft".equals(selectedTab)) {
                selectTabVisual("infinite-craft");
                sendWebEvent("boop-native-tab", "infinite-craft");
            } else if (SystemClock.elapsedRealtime() - lastBackMillis < 1800) {
                finish();
            } else {
                lastBackMillis = SystemClock.elapsedRealtime();
                Toast.makeText(this, "Press back again to exit Boop", Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override protected void onDestroy() {
        if (fileUploadCallback != null) {
            fileUploadCallback.onReceiveValue(null);
            fileUploadCallback = null;
        }
        if (webView != null) {
            webFrame.removeView(webView);
            webView.destroy();
        }
        super.onDestroy();
    }

    private int dp(float value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private GradientDrawable roundRect(int fill, int radius, int unused) {
        GradientDrawable d = new GradientDrawable();
        d.setColor(fill);
        d.setCornerRadius(dp(radius));
        return d;
    }
}
