package com.editorflow.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

/** Monitors real-time connectivity changes via ConnectivityManager.NetworkCallback. */
public class NetworkMonitor {

    public interface Listener {
        void onAvailable(); // called on a background thread
        void onLost();      // called on a background thread
    }

    private final ConnectivityManager cm;
    private final ConnectivityManager.NetworkCallback callback;
    private boolean registered = false;

    public NetworkMonitor(Context context, Listener listener) {
        cm = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        callback = new ConnectivityManager.NetworkCallback() {
            @Override public void onAvailable(Network net) { listener.onAvailable(); }
            @Override public void onLost(Network net)      { listener.onLost(); }
        };
    }

    public boolean isOnline() {
        Network active = cm.getActiveNetwork();
        if (active == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(active);
        return caps != null
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }

    public void register() {
        if (registered) return;
        NetworkRequest req = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();
        cm.registerNetworkCallback(req, callback);
        registered = true;
    }

    public void unregister() {
        if (!registered) return;
        try { cm.unregisterNetworkCallback(callback); } catch (IllegalArgumentException ignored) { }
        registered = false;
    }
}
