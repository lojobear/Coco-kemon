package app.boop.collect;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabsIntent;

/** Chrome Custom Tabs shares website origin cookies and browser sign-in. */
public final class MainActivity extends Activity {
    private static final String BOOP_URL = "https://coco-kemon.logaandavid.workers.dev/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        CustomTabsIntent intent = new CustomTabsIntent.Builder()
            .setShowTitle(false)
            .setToolbarColor(Color.rgb(23, 65, 50))
            .build();
        intent.launchUrl(this, Uri.parse(BOOP_URL));
        finish();
    }
}
