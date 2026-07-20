package com.editorflow.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Log;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

/**
 * Standalone Android WebView shell for EditorFlow.
 *
 * Architecture: AppCompatActivity + WebView loading the remote Vercel URL.
 * No Capacitor — direct control over URL routing, new-window handling,
 * file upload/download, back-button behaviour, and splash timing.
 *
 * Native bridge (window.EditorFlowNative) exposes the minimal surface the
 * web app needs: hideSplash() and setStatusBarStyle().
 */
public class MainActivity extends AppCompatActivity {

    // Primary host — the canonical URL the app always loads directly.
    private static final String APP_HOST        = "editorflow.vercel.app";
    private static final String APP_URL         = "https://editorflow.vercel.app";
    // Legacy host kept as internal so any cached redirect or deep link never opens Chrome.
    private static final String LEGACY_HOST     = "editorflow-final-out.vercel.app";
    private static final String TAG             = "EF_NAV";
    // Safety valve: dismiss the splash after 15 s even if MobileInit never fires
    private static final int    SPLASH_TIMEOUT  = 15_000;

    private WebView webView;
    // volatile: written from the JS-interface thread, read from the main thread
    private volatile boolean splashReady = false;

    // Modern ActivityResult API for <input type="file">
    private ValueCallback<Uri[]> fileChooserCallback;
    private final ActivityResultLauncher<Intent> filePickerLauncher =
        registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (fileChooserCallback == null) return;
                Uri[] uris = null;
                if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
                    uris = WebChromeClient.FileChooserParams.parseResult(
                        result.getResultCode(), result.getData());
                }
                fileChooserCallback.onReceiveValue(uris);
                fileChooserCallback = null;
            }
        );

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Must precede super.onCreate() so AndroidX SplashScreen can install itself
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Keep splash until MobileInit calls bridge.hideSplash(); fall back after timeout
        splashScreen.setKeepOnScreenCondition(() -> !splashReady);
        new Handler(Looper.getMainLooper()).postDelayed(
            () -> splashReady = true, SPLASH_TIMEOUT);

        setupEdgeToEdge();

        webView = new WebView(this);
        setContentView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));

        configureWebView();

        // JS bridge: splash + status bar control from the web layer
        webView.addJavascriptInterface(new NativeBridge(), "EditorFlowNative");
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());
        webView.setDownloadListener(this::handleDownload);

        setupBackButton();

        webView.loadUrl(APP_URL);
    }

    @Override protected void onResume()  { super.onResume();  webView.onResume();  }
    @Override protected void onPause()   { super.onPause();   webView.onPause();   }
    @Override protected void onDestroy() { webView.destroy(); super.onDestroy();   }

    // ── WebView configuration ─────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private void configureWebView() {
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        // Required for onCreateWindow to fire on target="_blank" / window.open()
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);
        // Never serve mixed content
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // App loads from remote; disable local file access
        s.setAllowFileAccess(false);
        // content:// URIs must be readable for the system file picker to work
        s.setAllowContentAccess(true);
    }

    // ── Edge-to-edge ──────────────────────────────────────────────────────────

    private void setupEdgeToEdge() {
        // Lay out behind the status and navigation bars (edge-to-edge)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }

    // ── Back-button handling ──────────────────────────────────────────────────

    private void setupBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Fire a cancelable DOM event so the web layer can intercept
                // (close command palette, dismiss Radix dialogs, etc.).
                // If any listener calls preventDefault() we treat it as consumed.
                webView.evaluateJavascript(
                    "(function(){"
                    + "var e=new CustomEvent('editorflow:backpress',"
                    + "{bubbles:true,cancelable:true});"
                    + "return !document.dispatchEvent(e);"
                    + "})()",
                    consumed -> {
                        if ("true".equals(consumed)) return; // web handled it
                        runOnUiThread(() -> {
                            if (webView.canGoBack()) webView.goBack();
                            else finish();
                        });
                    });
            }
        });
    }

    // ── JavaScript bridge ─────────────────────────────────────────────────────

    private class NativeBridge {

        /** Presence check: if (window.EditorFlowNative) { ... } */
        @JavascriptInterface
        public boolean isNative() { return true; }

        /** Called by MobileInit once React has hydrated — removes the splash. */
        @JavascriptInterface
        public void hideSplash() {
            splashReady = true; // volatile write visible to main-thread next frame
        }

        /**
         * Sync status-bar icon colour with the active app theme.
         * isDark = true  → white icons (dark-mode background)
         * isDark = false → dark icons (light-mode background)
         */
        @JavascriptInterface
        public void setStatusBarStyle(final boolean isDark) {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat wic = WindowCompat.getInsetsController(
                    getWindow(), getWindow().getDecorView());
                wic.setAppearanceLightStatusBars(!isDark);
            });
        }
    }

    // ── URL routing ───────────────────────────────────────────────────────────

    /** Returns true for both the canonical host and the legacy redirect source. */
    private boolean isAppHost(String host) {
        return APP_HOST.equalsIgnoreCase(host) || LEGACY_HOST.equalsIgnoreCase(host);
    }

    private class AppWebViewClient extends WebViewClient {

        @Override
        public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
            Log.d(TAG, "PAGE_STARTED  url=" + url);
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            Log.d(TAG, "PAGE_FINISHED url=" + url);
            super.onPageFinished(view, url);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri    url    = request.getUrl();
            String host   = url.getHost();
            String scheme = url.getScheme();

            // Both the canonical host and the legacy redirect origin stay in the WebView
            if (isAppHost(host) && "https".equalsIgnoreCase(scheme)) {
                Log.d(TAG, "INTERNAL      url=" + url);
                return false;
            }

            // Deep-link schemes: hand off to the appropriate system app
            if ("mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme)) {
                Log.d(TAG, "EXTERNAL_DEEP url=" + url);
                openExternal(url);
                return true;
            }

            // External http(s): open in the system browser
            if ("http".equals(scheme) || "https".equals(scheme)) {
                Log.d(TAG, "EXTERNAL_WEB  url=" + url);
                openExternal(url);
                return true;
            }

            Log.d(TAG, "BLOCKED       url=" + url);
            return true; // block intent:// and any other unusual schemes
        }
    }

    // ── New-window handling & file upload ─────────────────────────────────────

    private class AppWebChromeClient extends WebChromeClient {

        /**
         * Intercepts target="_blank" links and window.open() calls.
         * Same-origin targets load in the main WebView; external targets open in browser.
         */
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog,
                                      boolean isUserGesture, Message resultMsg) {
            // Attach a temporary WebView to receive the navigation URL, then route it
            WebView router = new WebView(view.getContext());
            router.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    Uri    target = req.getUrl();
                    String host   = target.getHost();
                    String scheme = target.getScheme();
                    if (isAppHost(host) && "https".equalsIgnoreCase(scheme)) {
                        Log.d(TAG, "WINDOW_INTERNAL url=" + target);
                        view.loadUrl(target.toString()); // keep in main WebView
                    } else {
                        Log.d(TAG, "WINDOW_EXTERNAL url=" + target);
                        openExternal(target);            // open in system browser
                    }
                    return true;
                }
            });
            ((WebView.WebViewTransport) resultMsg.obj).setWebView(router);
            resultMsg.sendToTarget();
            return true;
        }

        /** Handles <input type="file"> — document and photo uploads. */
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (fileChooserCallback != null) {
                fileChooserCallback.onReceiveValue(null); // cancel any pending request
            }
            fileChooserCallback = callback;
            try {
                filePickerLauncher.launch(params.createIntent());
            } catch (ActivityNotFoundException e) {
                fileChooserCallback = null;
                return false;
            }
            return true;
        }
    }

    // ── File download ─────────────────────────────────────────────────────────

    private void handleDownload(String url, String userAgent,
                                String contentDisposition, String mimeType,
                                long contentLength) {
        try {
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.addRequestHeader("User-Agent", userAgent);
            req.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(
                android.os.Environment.DIRECTORY_DOWNLOADS,
                URLUtil.guessFileName(url, contentDisposition, mimeType));
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) dm.enqueue(req);
        } catch (Exception ignored) { }
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private void openExternal(Uri url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url));
        } catch (ActivityNotFoundException ignored) { }
    }
}
