import { useEffect, useState } from 'react';
import { readEconomy, SAVE_CHANGED_EVENT, SAVE_IMPORTED_EVENT } from './saveData';
export function useEconomy() {
  const [economy, setEconomy] = useState(readEconomy);
  useEffect(() => {
    const refresh = () => setEconomy(readEconomy());
    refresh();
    window.addEventListener(SAVE_CHANGED_EVENT, refresh);
    window.addEventListener(SAVE_IMPORTED_EVENT, refresh);
    return () => {
      window.removeEventListener(SAVE_CHANGED_EVENT, refresh);
      window.removeEventListener(SAVE_IMPORTED_EVENT, refresh);
    };
  }, []);
  return economy;
}
