// The reply contract, shared by every bot in this repository: the Python and
// Go versions print byte-identical strings from the same fixtures, and the
// tests in each language assert it. Change one, change all three.

import type { Card, CardPrices, Price } from '@pokemontcgapi/sdk';

// One Cardmarket row per print language: an English copy and a French copy of
// the same card are two listings, not one price. The trial plan serves the
// English row only and says so in `meta.withheld`.
const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko'];

export const NO_QUOTE = 'no quote today';

export function title(card: Pick<Card, 'name' | 'set_name' | 'number'>): string {
  return `${card.name} · ${card.set_name} #${card.number}`;
}

// Raw copies only. A graded row is a different market, and on the API it is a
// different plan: a bigger bot gives slabs their own command.
export function raw(quotes: readonly Price[]): Price[] {
  return quotes.filter((q) => q.grading === null);
}

export function europe(quotes: readonly Price[]): string {
  const rows = raw(quotes)
    .filter((q) => q.source === 'CARDMARKET' && q.variant === 'LOW')
    .sort((a, b) => LOCALES.indexOf(a.locale ?? '') - LOCALES.indexOf(b.locale ?? ''));
  if (rows.length === 0) return NO_QUOTE;
  const lines = rows.map(
    (q) => `${(q.locale ?? '??').toUpperCase()} ${q.amount.toFixed(2)} ${q.currency} · ${q.basis.toLowerCase()} · ${q.as_of}`,
  );
  return `${lines.join('\n')}\nCardmarket, lowest asking price per print language`;
}

export function unitedStates(quotes: readonly Price[]): string {
  const q = raw(quotes).find((row) => row.source === 'TCGPLAYER');
  return q ? `${q.amount.toFixed(2)} ${q.currency} · ${q.basis.toLowerCase()} · ${q.as_of} · ${q.provenance}` : NO_QUOTE;
}

export function footer(index: CardPrices['index']): string {
  return index ? `Index ${index.eur.toFixed(2)} EUR · ${index.as_of}` : 'No index for this card';
}

export function art(card: Pick<Card, 'images'>): string | undefined {
  const image = card.images?.find((i) => i.size === 'LARGE') ?? card.images?.[0];
  return image?.url;
}
