# ─── JavaScript bridge ────────────────────────────────────────────────────────
# Keep @JavascriptInterface methods injected into the WebView via NativeBridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── AndroidX SplashScreen ───────────────────────────────────────────────────
-keep class androidx.core.splashscreen.** { *; }
-dontwarn androidx.**

# ─── Debugging: keep source file names and line numbers in stack traces ───────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
