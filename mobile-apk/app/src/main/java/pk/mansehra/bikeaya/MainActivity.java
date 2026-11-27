package pk.mansehra.bikeaya;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import org.json.JSONObject;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://mansehra-bikeaya.onrender.com";
    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> filePathCallback;

    private String pendingGeoOrigin = null;
    private GeolocationPermissions.Callback pendingGeoCallback = null;
    private LocationListener activeLocationListener = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private boolean hasLocationPermission() {
        return ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private final ActivityResultLauncher<String[]> locationPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), granted -> {
                boolean allowed = Boolean.TRUE.equals(granted.get(Manifest.permission.ACCESS_FINE_LOCATION))
                        || Boolean.TRUE.equals(granted.get(Manifest.permission.ACCESS_COARSE_LOCATION))
                        || hasLocationPermission();

                if (pendingGeoCallback != null && pendingGeoOrigin != null) {
                    pendingGeoCallback.invoke(pendingGeoOrigin, allowed, allowed);
                    pendingGeoCallback = null;
                    pendingGeoOrigin = null;
                }

                if (allowed) {
                    requestNativeSingleFix();
                    if (webView != null) {
                        webView.post(() -> webView.evaluateJavascript(
                                "window.dispatchEvent(new Event('safargo-location-ready'));",
                                null
                        ));
                    }
                }
            });

    private final ActivityResultLauncher<Intent> fileChooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), result -> {
                if (filePathCallback == null) return;
                Uri[] results = WebChromeClient.FileChooserParams.parseResult(result.getResultCode(), result.getData());
                filePathCallback.onReceiveValue(results);
                filePathCallback = null;
            });

    @SuppressLint("MissingPermission")
    private Location pickBestLastKnownLocation() {
        if (!hasLocationPermission()) return null;
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return null;

        Location best = null;
        String[] providers = new String[] {
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER,
                LocationManager.PASSIVE_PROVIDER
        };
        for (String provider : providers) {
            try {
                if (!lm.isProviderEnabled(provider)) continue;
                Location loc = lm.getLastKnownLocation(provider);
                if (loc == null) continue;
                if (best == null) {
                    best = loc;
                } else {
                    long timeDiff = loc.getTime() - best.getTime();
                    boolean muchNewer = timeDiff > 60_000L;
                    boolean fresher = timeDiff >= -30_000L && loc.getAccuracy() <= best.getAccuracy();
                    if (muchNewer || fresher) {
                        best = loc;
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return best;
    }

    private void stopNativeLocationUpdates() {
        try {
            if (activeLocationListener != null) {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                if (lm != null) {
                    lm.removeUpdates(activeLocationListener);
                }
                activeLocationListener = null;
            }
        } catch (Exception ignored) {
        }
    }

    @SuppressLint("MissingPermission")
    private void requestNativeSingleFix() {
        if (!hasLocationPermission()) return;
        LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
        if (lm == null) return;

        mainHandler.post(() -> {
            stopNativeLocationUpdates();
            activeLocationListener = new LocationListener() {
                @Override
                public void onLocationChanged(@NonNull Location loc) {
                    if (webView != null) {
                        String js = "window.dispatchEvent(new CustomEvent('safargo-native-location',{detail:{lat:"
                                + loc.getLatitude()
                                + ",lng:"
                                + loc.getLongitude()
                                + ",accuracy:"
                                + loc.getAccuracy()
                                + "}}));";
                        webView.post(() -> webView.evaluateJavascript(js, null));
                    }
                    if (loc.hasAccuracy() && loc.getAccuracy() <= 45f) {
                        stopNativeLocationUpdates();
                    }
                }

                @Override
                public void onStatusChanged(String provider, int status, Bundle extras) {}

                @Override
                public void onProviderEnabled(@NonNull String provider) {}

                @Override
                public void onProviderDisabled(@NonNull String provider) {}
            };

            try {
                if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 0L, 0f, activeLocationListener, Looper.getMainLooper());
                }
                if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                    lm.requestLocationUpdates(LocationManager.GPS_PROVIDER, 0L, 0f, activeLocationListener, Looper.getMainLooper());
                }
            } catch (Exception ignored) {
            }

            mainHandler.postDelayed(this::stopNativeLocationUpdates, 12_000L);
        });
    }

    public class SafarGoNativeBridge {
        @JavascriptInterface
        public String getLastLocation() {
            try {
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                boolean enabled = lm != null && LocationManagerCompat.isLocationEnabled(lm);
                boolean granted = hasLocationPermission();
                Location best = pickBestLastKnownLocation();
                JSONObject out = new JSONObject();
                out.put("locationEnabled", enabled);
                out.put("permissionGranted", granted);
                if (best != null) {
                    out.put("ok", true);
                    out.put("lat", best.getLatitude());
                    out.put("lng", best.getLongitude());
                    out.put("accuracy", best.hasAccuracy() ? best.getAccuracy() : 50.0);
                    out.put("provider", best.getProvider() != null ? best.getProvider() : "android");
                } else {
                    out.put("ok", false);
                }
                return out.toString();
            } catch (Exception e) {
                return "{\"ok\":false}";
            }
        }

        @JavascriptInterface
        public void requestFreshLocation() {
            if (hasLocationPermission()) {
                requestNativeSingleFix();
            } else {
                mainHandler.post(() -> locationPermissionLauncher.launch(new String[] {
                        Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                }));
            }
        }

        @JavascriptInterface
        public boolean isLocationEnabled() {
            LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            return lm != null && LocationManagerCompat.isLocationEnabled(lm);
        }

        @JavascriptInterface
        public void openLocationSettings() {
            mainHandler.post(() -> {
                try {
                    startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS));
                } catch (Exception ignored) {
                }
            });
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if (!hasLocationPermission()) {
            locationPermissionLauncher.launch(new String[] {
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
            });
        } else {
            requestNativeSingleFix();
        }

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        // Remove "; wv" token so CDN & OpenStreetMap map tiles load cleanly like standard Chrome
        String defaultUa = settings.getUserAgentString();
        if (defaultUa != null) {
            settings.setUserAgentString(defaultUa.replace("; wv)", ")").replace(" wv ", " "));
        }

        webView.addJavascriptInterface(new SafarGoNativeBridge(), "SafarGoNative");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, true);
                } else {
                    pendingGeoOrigin = origin;
                    pendingGeoCallback = callback;
                    locationPermissionLauncher.launch(new String[] {
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    });
                }
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    fileChooserLauncher.launch(intent);
                    return true;
                } catch (Exception e) {
                    MainActivity.this.filePathCallback = null;
                    return false;
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme() : "";
                String host = uri.getHost() != null ? uri.getHost() : "";
                if ("tel".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_DIAL, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if ("mailto".equals(scheme) || "whatsapp".equals(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                if (!host.contains("mansehra-bikeaya.onrender.com") && ("http".equals(scheme) || "https".equals(scheme))) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                progressBar.setVisibility(View.GONE);
                // If Render free tier shows its cold-start interstitial, auto-poll softly so APK lands on SafarGo automatically
                view.evaluateJavascript(
                        "(function(){try{var t=(document.body&&document.body.innerText)||'';if(t.indexOf('Service waking up')!==-1||t.indexOf('Application loading')!==-1){setTimeout(function(){window.location.href='" + APP_URL + "';},6000);}}catch(e){}})();",
                        null
                );
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String offlineHtml = "<html><body style='font-family:sans-serif;text-align:center;padding:48px 20px;background:#F4F6FB;color:#0F172A;'>"
                            + "<h2 style='color:#009E4D;'>SafarGo · Live Dispatch</h2>"
                            + "<p>Waking up SafarGo server... Reconnecting automatically in a few seconds.</p>"
                            + "<button onclick=\"window.location.href='" + APP_URL + "'\" "
                            + "style='background:#009E4D;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;font-size:15px;'>Retry Now</button>"
                            + "<script>setTimeout(function(){window.location.href='" + APP_URL + "';},4500);</script>"
                            + "</body></html>";
                    view.loadDataWithBaseURL(null, offlineHtml, "text/html", "UTF-8", null);
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setData(Uri.parse(url));
                startActivity(i);
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });

        webView.loadUrl(APP_URL);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (hasLocationPermission()) {
            requestNativeSingleFix();
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                        "window.dispatchEvent(new Event('safargo-location-ready'));",
                        null
                ));
            }
        }
    }

    @Override
    protected void onDestroy() {
        stopNativeLocationUpdates();
        mainHandler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
