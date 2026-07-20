package com.editorflow.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.widget.Toast;
import java.util.Locale;

/** Routes WebView download events through Android's DownloadManager. */
public class DownloadHandler {

    private final Context context;
    private final PermissionManager perms;

    public DownloadHandler(Context context, PermissionManager perms) {
        this.context = context;
        this.perms = perms;
    }

    public void onDownloadRequested(String url, String userAgent,
                                    String contentDisposition, String mimeType,
                                    long contentLength) {
        perms.requestStorageWrite(granted -> {
            if (!granted) {
                Toast.makeText(context,
                    context.getString(R.string.storage_permission_required),
                    Toast.LENGTH_SHORT).show();
                return;
            }
            enqueue(url, userAgent, contentDisposition, mimeType);
        });
    }

    private void enqueue(String url, String userAgent,
                         String contentDisposition, String mimeType) {
        try {
            String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
            if (mimeType == null || mimeType.isEmpty()) {
                mimeType = resolveMimeType(fileName);
            }

            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url));
            req.setMimeType(mimeType);
            req.addRequestHeader("User-Agent", userAgent);
            req.setTitle(fileName);
            req.setDescription(context.getString(R.string.download_description));
            req.setNotificationVisibility(
                DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            req.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);

            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                //noinspection deprecation
                req.allowScanningByMediaScanner();
            }

            DownloadManager dm = (DownloadManager)
                context.getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                dm.enqueue(req);
                Toast.makeText(context,
                    context.getString(R.string.download_started, fileName),
                    Toast.LENGTH_SHORT).show();
            }
        } catch (Exception e) {
            Toast.makeText(context,
                context.getString(R.string.download_failed), Toast.LENGTH_SHORT).show();
        }
    }

    private String resolveMimeType(String fileName) {
        if (fileName == null) return "application/octet-stream";
        int dot = fileName.lastIndexOf('.');
        if (dot < 0) return "application/octet-stream";
        String ext = fileName.substring(dot + 1).toLowerCase(Locale.US);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }
}
