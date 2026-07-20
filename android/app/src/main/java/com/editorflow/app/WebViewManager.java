package com.editorflow.app;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Owns the WebView instance and its configuration.
 * Hosts WebViewClient (URL routing, error handling) and WebChromeClient (new windows, file upload).
 * Delegates page lifecycle and external navigation events to {@link Callbacks}.
 */
public class WebViewManager {

    static final String PRIMARY_HOST = "editorflow.vercel.app";
    static final String LEGACY_HOST  = "editorflow-final-out.vercel.app";

    public interface Callbacks {
        void onPageStarted();
        void onPageFinished();
        /** @param isNetworkError true for no-connection, false for SSL/HTTP errors */
        void onPageError(boolean isNetworkError);
        boolean onFileChooserRequest(ValueCallback<Uri[]> cb, WebChromeClient.FileChooserParams p);
        void openExternal(Uri url);
    }

    private final WebView webView;
    private final Callbacks callbacks;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    public WebViewManager(Context context, Callbacks callbacks) {
        this.callbacks = callbacks;
        webView = new WebView(context);
        configureSettings(webView.getSettings());
        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppWebChromeClient());

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
    }

    public WebView getView() { return webView; }

    public void load(String url)        { webView.loadUrl(url); }
    public boolean canGoBack()          { return webView.canGoBack(); }
    public void goBack()                { webView.goBack(); }
    public void reload()                { webView.reload(); }
    public void onResume()              { webView.onResume(); }
    public void onPause()               { webView.onPause(); }
    public void saveState(Bundle out)   { webView.saveState(out); }
    public void restoreState(Bundle in) { webView.restoreState(in); }

    public void addJavascriptInterface(Object obj, String name) {
        webView.addJavascriptInterface(obj, name);
    }

    public void setDownloadListener(DownloadListener listener) {
        webView.setDownloadListener(listener);
    }

    public void evaluateJavascript(String script, ValueCallback<String> cb) {
        webView.evaluateJavascript(script, cb);
    }

    public void destroy() {
        webView.stopLoading();
        webView.setWebViewClient(null);
        webView.setWebChromeClient(null);
        webView.clearHistory();
        webView.removeAllViews();
        webView.destroy();
    }

    // ── Settings ──────────────────────────────────────────────────────────────

    @SuppressLint("SetJavaScriptEnabled")
    private void configureSettings(WebSettings s) {
        // Core
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);

        // Window / viewport
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        // New-window handling (target=_blank, window.open)
        s.setJavaScriptCanOpenWindowsAutomatically(true);
        s.setSupportMultipleWindows(true);

        // Security
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true); // required for file picker content:// URIs
        s.setSafeBrowsingEnabled(true);

        // Caching: respect HTTP cache headers
        s.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Dark mode: let WebView content match the system theme
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            s.setAlgorithmicDarkeningAllowed(true);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            //noinspection deprecation
            s.setForceDark(WebSettings.FORCE_DARK_AUTO);
        }
    }

    // ── URL routing helpers ───────────────────────────────────────────────────

    private boolean isAppHost(String host) {
        return PRIMARY_HOST.equalsIgnoreCase(host) || LEGACY_HOST.equalsIgnoreCase(host);
    }

    // ── WebViewClient ─────────────────────────────────────────────────────────

    private class AppWebViewClient extends WebViewClient {

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            callbacks.onPageStarted();
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            callbacks.onPageFinished();
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri    url    = request.getUrl();
            String host   = url.getHost();
            String scheme = url.getScheme() != null ? url.getScheme() : "";

            // Both the canonical host and the legacy redirect origin stay in WebView
            if (isAppHost(host) && "https".equalsIgnoreCase(scheme)) return false;

            if ("mailto".equals(scheme) || "tel".equals(scheme) || "sms".equals(scheme)) {
                callbacks.openExternal(url);
                return true;
            }
            if ("http".equals(scheme) || "https".equals(scheme)) {
                callbacks.openExternal(url);
                return true;
            }
            return true; // block intent:// and any other unusual schemes
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request,
                                    WebResourceError error) {
            if (request.isForMainFrame()) {
                callbacks.onPageError(true);
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            handler.cancel(); // never proceed — SSL errors are fatal
            callbacks.onPageError(false);
        }
    }

    // ── WebChromeClient ───────────────────────────────────────────────────────

    private class AppWebChromeClient extends WebChromeClient {

        /** Intercepts target="_blank" / window.open(). Same-origin → main WebView; else → browser. */
        @Override
        public boolean onCreateWindow(WebView view, boolean isDialog,
                                      boolean isUserGesture, Message resultMsg) {
            WebView router = new WebView(view.getContext());
            router.setWebViewClient(new WebViewClient() {
                @Override
                public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                    Uri    target = req.getUrl();
                    String host   = target.getHost();
                    String scheme = target.getScheme() != null ? target.getScheme() : "";
                    if (isAppHost(host) && "https".equalsIgnoreCase(scheme)) {
                        view.loadUrl(target.toString());
                    } else {
                        callbacks.openExternal(target);
                    }
                    return true;
                }
            });
            ((WebView.WebViewTransport) resultMsg.obj).setWebView(router);
            resultMsg.sendToTarget();
            return true;
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            return callbacks.onFileChooserRequest(callback, params);
        }
    }
}
