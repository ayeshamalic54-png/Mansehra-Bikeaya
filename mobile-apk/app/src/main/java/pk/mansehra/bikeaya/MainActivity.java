package pk.mansehra.bikeaya;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private static final String APP_URL = "https://mansehra-bikeaya.onrender.com";
    private WebView webView;
    private ProgressBar progressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        progressBar = findViewById(R.id.progressBar);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

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
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() != null ? uri.getScheme() : "";
                String host = uri.getHost() != null ? uri.getHost() : "";
                if ("tel".equals(scheme) || "mailto".equals(scheme) || "whatsapp".equals(scheme)) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                if (!host.contains("mansehra-bikeaya.onrender.com") && ("http".equals(scheme) || "https".equals(scheme))) {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    return true;
                }
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                progressBar.setVisibility(View.VISIBLE);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    String offlineHtml = "<html><body style='font-family:sans-serif;text-align:center;padding:48px 20px;background:#F4F6FB;color:#0F172A;'>"
                            + "<h2 style='color:#00A651;'>Mansehra Bikeaya</h2>"
                            + "<p>Internet connection required or server waking up...</p>"
                            + "<button onclick=\"window.location.href='" + APP_URL + "'\" "
                            + "style='background:#00A651;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:bold;font-size:15px;'>Retry Now</button>"
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
}
