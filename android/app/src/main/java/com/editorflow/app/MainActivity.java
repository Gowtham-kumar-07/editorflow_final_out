package com.editorflow.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

public class MainActivity extends AppCompatActivity implements WebViewManager.Callbacks {

    private static final String APP_URL       = "https://editorflow.vercel.app";
    private static final int    SPLASH_TIMEOUT = 15_000;
    private static final long   BACK_EXIT_MS   = 2_000;

    private WebViewManager   wvm;
    private PermissionManager perms;
    private FileChooserHandler fileChooser;
    private DownloadHandler    downloader;
    private NetworkMonitor     network;

    private View loadingView;
    private View offlineView;

    private volatile boolean splashReady  = false;
    private boolean          showingError = false;
    private long             lastBackMs   = 0;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        splash.setKeepOnScreenCondition(() -> !splashReady);
        new Handler(Looper.getMainLooper()).postDelayed(() -> splashReady = true, SPLASH_TIMEOUT);

        setupEdgeToEdge();
        setContentView(R.layout.activity_main);

        loadingView = findViewById(R.id.loading_view);
        offlineView = findViewById(R.id.offline_view);
        findViewById(R.id.retry_button).setOnClickListener(v -> retryConnection());

        // Helper initialisation order: perms first, then handlers that depend on perms
        perms       = new PermissionManager(this);
        fileChooser = new FileChooserHandler(this, perms);
        downloader  = new DownloadHandler(this, perms);
        network     = new NetworkMonitor(this, new NetworkMonitor.Listener() {
            @Override public void onAvailable() { runOnUiThread(MainActivity.this::onNetworkBack); }
            @Override public void onLost()      { /* handled via page-error callback */ }
        });

        wvm = new WebViewManager(this, this);
        wvm.addJavascriptInterface(new NativeBridge(), "EditorFlowNative");
        wvm.setDownloadListener((url, ua, cd, mime, len) ->
            downloader.onDownloadRequested(url, ua, cd, mime, len));

        android.widget.FrameLayout container = findViewById(R.id.webview_container);
        container.addView(wvm.getView(),
            new android.widget.FrameLayout.LayoutParams(
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
                android.widget.FrameLayout.LayoutParams.MATCH_PARENT));

        setupBackButton();

        if (savedInstanceState != null) {
            wvm.restoreState(savedInstanceState);
        } else if (network.isOnline()) {
            wvm.load(APP_URL);
        } else {
            showError();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        wvm.saveState(out);
    }

    @Override protected void onStart()   { super.onStart();   network.register();  }
    @Override protected void onResume()  { super.onResume();  wvm.onResume();      }
    @Override protected void onPause()   { super.onPause();   wvm.onPause();       }
    @Override protected void onStop()    { super.onStop();    network.unregister();}
    @Override protected void onDestroy() { wvm.destroy();     super.onDestroy();   }

    // ── WebViewManager.Callbacks ──────────────────────────────────────────────

    @Override
    public void onPageStarted() {
        runOnUiThread(() -> {
            showingError = false;
            offlineView.setVisibility(View.GONE);
            loadingView.setAlpha(1f);
            loadingView.setVisibility(View.VISIBLE);
        });
    }

    @Override
    public void onPageFinished() {
        runOnUiThread(() -> {
            splashReady = true;
            loadingView.animate()
                .alpha(0f)
                .setDuration(250)
                .withEndAction(() -> loadingView.setVisibility(View.GONE))
                .start();
        });
    }

    @Override
    public void onPageError(boolean isNetworkError) {
        runOnUiThread(this::showError);
    }

    @Override
    public boolean onFileChooserRequest(ValueCallback<Uri[]> cb,
                                        WebChromeClient.FileChooserParams p) {
        return fileChooser.handle(cb, p);
    }

    @Override
    public void openExternal(Uri url) {
        try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
        catch (ActivityNotFoundException ignored) { }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private void showError() {
        loadingView.clearAnimation();
        loadingView.setVisibility(View.GONE);
        offlineView.setVisibility(View.VISIBLE);
        showingError = true;
        splashReady  = true;
    }

    private void onNetworkBack() {
        if (showingError) retryConnection();
    }

    private void retryConnection() {
        if (!network.isOnline()) return; // still offline; button will try again on next press
        offlineView.setVisibility(View.GONE);
        loadingView.setAlpha(1f);
        loadingView.setVisibility(View.VISIBLE);
        showingError = false;
        wvm.reload();
    }

    private void setupBackButton() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (wvm.canGoBack()) {
                    wvm.goBack();
                    return;
                }
                long now = System.currentTimeMillis();
                if (now - lastBackMs < BACK_EXIT_MS) {
                    finish();
                } else {
                    lastBackMs = now;
                    Toast.makeText(MainActivity.this,
                        R.string.back_press_to_exit, Toast.LENGTH_SHORT).show();
                }
            }
        });
    }

    private void setupEdgeToEdge() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
    }

    // ── JavaScript bridge ─────────────────────────────────────────────────────

    private class NativeBridge {

        /** Presence check: if (window.EditorFlowNative) { ... } */
        @JavascriptInterface
        public boolean isNative() { return true; }

        /** Called by MobileInit once React has hydrated — releases the splash screen. */
        @JavascriptInterface
        public void hideSplash() { splashReady = true; }

        /**
         * isDark=true  → white status-bar icons (dark content behind them)
         * isDark=false → dark status-bar icons (light content behind them)
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
}
