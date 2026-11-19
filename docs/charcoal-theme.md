# Charcoal interface

The default Boop interface now uses an authored charcoal palette with blue actions, mint progress/success accents and gold coin values. The craft board is #1b1e24, the app canvas #15171b and panels #20242b. Raised controls and labels use #292e37 with #f0f1f5 primary text and #b0b7c5 secondary text.

The palette is scoped to the app root through data-palette="charcoal" and loaded after the existing style sheets. Legacy data-theme selectors remain in place for layout compatibility. The override sheet bridges existing hard-coded light surfaces without changing game state, board layout or artwork. No theme inversion/recoloring is applied to sprite images; existing intentional special-form effects remain. Browser color scheme, PWA launch/background colors, native Android toolbar, system bars and WebView backdrop share the palette. Native algorithmic darkening stays disabled.

Validation: main screens visually reviewed at 412 and 1440 pixels; visible text contrast and leftover bright surfaces inspected. Existing native/sprite/PWA theme assertions updated. Automated viewport regression covers additional phone/tablet sizes and existing craft, filter, board and Sprite Lab flows. APK preview: 3.11.
