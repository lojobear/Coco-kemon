import { useState } from 'react';
import { useEconomy } from '../lib/useEconomy';
import { availableCopies } from '../lib/economy';
import { sellElement } from '../lib/saveData';
import { Coins } from 'lucide-react';
import type { InfiniteElement } from '../lib/infiniteCraftData';
import type { CollectorVariant } from '../lib/collectorData';
import { elementValue, formatElementValue, VALUE_FORM_LABELS } from '../lib/elementValue';

export function ElementValueBadge({ element, variant = 'best' }: {
  element: InfiniteElement; variant?: CollectorVariant | 'best';
}) {
  const value = elementValue(element, variant);
  const label = `${VALUE_FORM_LABELS[value.variant]} guide value: ${formatElementValue(value.coins)} ${value.currency}`;
  return <span className="boop-element-value-badge" aria-label={label} title={label}>
    <Coins size={14} aria-hidden="true" /><span>{formatElementValue(value.coins)} coins</span>
  </span>;
}

export function ElementValuePanel({ element, variant = 'best' }: {
  element: InfiniteElement; variant?: CollectorVariant | 'best';
}) {
  const value = elementValue(element, variant);
  const economy = useEconomy();
  const [message, setMessage] = useState('');
  const copies = availableCopies(element, economy, value.variant);
  const sell = () => {
    try {
      const result = sellElement(element.name, value.variant, 1, value.coins);
      setMessage(`Sold 1 ${VALUE_FORM_LABELS[value.variant].toLowerCase()} copy for ${formatElementValue(result.proceeds)} coins.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Sale could not be saved.'); }
  };
  return <section className="boop-element-value-panel" aria-label="Element guide value">
    <div className="boop-element-value-heading"><span>Guide value · {VALUE_FORM_LABELS[value.variant]}</span>
      <strong><Coins size={21} aria-hidden="true" />{formatElementValue(value.coins)} {value.currency}</strong></div>
    <p>{value.baseCoins} base × {value.rarityMultiplier} {value.rarity.toLowerCase()} × {value.formMultiplier} form.</p>
    <small>Each form is valued separately. Selling a copy keeps this discovery unlocked for crafting.</small>
    <div className="boop-element-sell-row"><span>{copies.toLocaleString('en-CA')} {copies === 1 ? 'copy' : 'copies'} available</span>
      <button type="button" disabled={copies === 0} onClick={sell}>Sell 1 for {formatElementValue(value.coins)} coins</button></div>
    {copies === 0 && <small>Craft this form to earn a sellable copy. Supplied starters cannot be sold.</small>}
    {message && <p role="status">{message}</p>}
  </section>;
}

export function WalletBalance() {
  const economy = useEconomy();
  return <span className="boop-wallet-balance" aria-label={`Wallet: ${formatElementValue(economy.coins)} Boop Coins`}>
    <Coins size={18} aria-hidden="true" /><strong>{formatElementValue(economy.coins)}</strong><span>Boop Coins</span>
  </span>;
}
