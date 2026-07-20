package com.editorflow.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Wraps runtime permission requests using the modern ActivityResult API. */
public class PermissionManager {

    public interface Callback { void onResult(boolean allGranted); }

    private final AppCompatActivity activity;
    private Callback pending;

    private final ActivityResultLauncher<String[]> launcher;

    public PermissionManager(AppCompatActivity activity) {
        this.activity = activity;
        launcher = activity.registerForActivityResult(
            new ActivityResultContracts.RequestMultiplePermissions(),
            results -> {
                if (pending == null) return;
                boolean ok = true;
                for (Boolean v : results.values()) if (!v) { ok = false; break; }
                Callback cb = pending;
                pending = null;
                cb.onResult(ok);
            }
        );
    }

    public boolean has(String permission) {
        return ContextCompat.checkSelfPermission(activity, permission)
               == PackageManager.PERMISSION_GRANTED;
    }

    /** Requests only the permissions not yet granted; calls callback immediately if all granted. */
    public void request(Callback callback, String... permissions) {
        List<String> needed = new ArrayList<>();
        for (String p : permissions) if (!has(p)) needed.add(p);
        if (needed.isEmpty()) { callback.onResult(true); return; }
        pending = callback;
        launcher.launch(needed.toArray(new String[0]));
    }

    public void requestCamera(Callback callback) {
        request(callback, Manifest.permission.CAMERA);
    }

    /**
     * On API 29+ (Android 10+) apps write to public Downloads without any permission.
     * On API 28 and below WRITE_EXTERNAL_STORAGE is required.
     */
    public void requestStorageWrite(Callback callback) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            callback.onResult(true);
        } else {
            request(callback, Manifest.permission.WRITE_EXTERNAL_STORAGE);
        }
    }
}
