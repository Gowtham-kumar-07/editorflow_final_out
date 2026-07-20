package com.editorflow.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Handles &lt;input type="file"&gt; from the WebView.
 * Supports file picker, document picker, gallery, and camera capture.
 */
public class FileChooserHandler {

    private final AppCompatActivity activity;
    private final PermissionManager perms;
    private ValueCallback<Uri[]> pendingCallback;
    private Uri cameraOutputUri;

    private final ActivityResultLauncher<Intent> launcher;

    public FileChooserHandler(AppCompatActivity activity, PermissionManager perms) {
        this.activity = activity;
        this.perms = perms;
        launcher = activity.registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> deliverResult(result.getResultCode(), result.getData())
        );
    }

    /** Called from WebChromeClient.onShowFileChooser. Returns true if the request was handled. */
    public boolean handle(ValueCallback<Uri[]> callback,
                          WebChromeClient.FileChooserParams params) {
        if (pendingCallback != null) {
            pendingCallback.onReceiveValue(null);
            pendingCallback = null;
        }
        pendingCallback = callback;

        // Request camera permission before building the chooser so we can include camera intent
        perms.requestCamera(granted -> {
            Intent chooser = buildChooser(params, granted);
            try {
                launcher.launch(chooser);
            } catch (Exception e) {
                deliver(null);
            }
        });
        return true;
    }

    private Intent buildChooser(WebChromeClient.FileChooserParams params, boolean cameraGranted) {
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);

        boolean multiple = params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE;
        if (multiple) pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);

        String[] accept = params.getAcceptTypes();
        if (accept != null && accept.length > 0 && !accept[0].isEmpty()) {
            if (accept.length == 1) {
                pick.setType(accept[0]);
            } else {
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, accept);
            }
        } else {
            pick.setType("*/*");
        }

        Intent chooser = Intent.createChooser(pick, "Choose file");

        if (cameraGranted) {
            Intent camera = buildCameraIntent();
            if (camera != null) {
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{ camera });
            }
        }
        return chooser;
    }

    private Intent buildCameraIntent() {
        try {
            File dir = activity.getExternalCacheDir();
            if (dir == null) dir = activity.getCacheDir();
            if (!dir.exists()) dir.mkdirs();

            String stamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            File imageFile = new File(dir, "IMG_" + stamp + ".jpg");
            imageFile.createNewFile();

            cameraOutputUri = FileProvider.getUriForFile(
                activity,
                activity.getPackageName() + ".fileprovider",
                imageFile);

            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraOutputUri);
            return intent;
        } catch (IOException | IllegalArgumentException e) {
            cameraOutputUri = null;
            return null;
        }
    }

    private void deliverResult(int resultCode, Intent data) {
        if (pendingCallback == null) return;

        Uri[] uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data);

        // Camera result: data is null but image was written to cameraOutputUri
        if ((uris == null || uris.length == 0)
                && cameraOutputUri != null
                && resultCode == Activity.RESULT_OK) {
            uris = new Uri[]{ cameraOutputUri };
        }
        cameraOutputUri = null;
        deliver(uris);
    }

    private void deliver(Uri[] uris) {
        if (pendingCallback == null) return;
        pendingCallback.onReceiveValue(uris);
        pendingCallback = null;
    }
}
