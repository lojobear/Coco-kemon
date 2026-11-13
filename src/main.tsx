import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { initializeLocalSave } from './lib/saveData';
import './index.css';
import './boop.css';
import './toybox.css';
import './element-value.css';

// Chrome's OAuth callback hands the PKCE code back to the Android WebView.
// Do NOT mount Supabase in Chrome first or it would consume that code.
if (!(window as Window & { __boopNativeAuthReturn?: boolean }).__boopNativeAuthReturn) {
  const root=createRoot(document.getElementById('root')!);
  root.render(<main style={{padding:24,fontFamily:'sans-serif'}}>Opening your saved collection…</main>);
  void initializeLocalSave().then(()=>root.render(<StrictMode><App/></StrictMode>)).catch(error=>{
    // Never mount a fresh game over a save that could not be hydrated.
    root.render(<main role="alert" style={{padding:24,fontFamily:'sans-serif'}}><h1>Boop save recovery</h1><p>{error instanceof Error?error.message:'Your saved collection could not be opened.'}</p><p>Your existing data has not been cleared. Do not uninstall or clear app data.</p><button onClick={()=>location.reload()}>Retry opening Boop</button></main>);
  });
}
