/**
 * Native Android navigation bridge. It only runs inside Boop's Android shell;
 * normal web and PWA clients keep their existing header and tab bar.
 */
export type NativeTab = 'kitchen' | 'infinite-craft' | 'foundry' | 'archive' | 'sprite-lab' | 'notebook' | 'profile';
export const NATIVE_TABS: readonly NativeTab[] = ['kitchen','infinite-craft','foundry','archive','sprite-lab','notebook','profile'];

type NativePort = { postMessage: (message: string) => void };
type NativeWindow = Window & { BoopNative?: NativePort };

export function isAndroidNativeShell() {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('boop_android') === '1'
    && /BoopAndroid\/\d+/i.test(window.navigator.userAgent);
}

export function isNativeTab(value: string): value is NativeTab {
  return (NATIVE_TABS as readonly string[]).includes(value);
}

export function sendToAndroid(message: { type: string; tab?: NativeTab; url?: string }): boolean {
  if (!isAndroidNativeShell()) return false;
  const port = (window as NativeWindow).BoopNative;
  if (!port || typeof port.postMessage !== 'function') return false;
  port.postMessage(JSON.stringify(message));
  return true;
}

export function nativeOAuthRedirect() {
  return `${window.location.origin}/?boop_native_oauth=1`;
}
