# Rotating logo artwork

The header rotates through saved discovery artwork every 30 seconds. It reads uploaded/profile/cache artwork without requesting AI generation. The next image is resolved, loaded and decoded offscreen before its name or image is committed. Missing and failed artwork is skipped, and slow loads leave the current image visible. The old ready image remains behind the new one during the fade; no generic sprite or loading placeholder is mounted in the logo.

Collections without available discovery artwork keep the Secret Spark fusion icon. Rotation pauses in a hidden tab or while the sprite name is open, and respects reduced-motion preferences. Imported collections invalidate pending image loads.

The permanent wordmark preserves the Figma design's negative-space spark in both palettes. The rotating discovery artwork remains independent of the wordmark.
