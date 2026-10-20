import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import './boop.css';

// Chrome's OAuth callback hands the PKCE code back to the Android WebView.
// Do NOT mount Supabase in Chrome first or it would consume that code.
if (!(window as Window & { __boopNativeAuthReturn?: boolean }).__boopNativeAuthReturn) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
