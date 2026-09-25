// The reply contract, shared by every bot in this repository: the Python and
// Go versions print byte-identical strings from the same fixtures, and the
// tests in each language assert it. Change one, change all three.

import type { Card, CardPrices, Price } from '@pokemontcgapi/sdk';

// One Cardmarket row per print language: an English copy and a French copy of
// the same card are two listings, not one price. The trial plan serves the
// English row only and says so in `meta.withheld`.
const LOCALES = ['en', 'de', 'fr', 'es', 'it', 'pt', 'ja', 'zh', 'ko'];

export const NO_QUOTE = 'no quote today';

// Where the numbers come from, in the footer of every reply. Keep it if you run a copy of this bot:
// it is how the people in your server find the data, and it costs nothing.
export const CREDIT = 'Prices via pokemontcgapi.com';

export function title(card: Pick<Card, 'name' | 'set_name' | 'number'>): string {
  return `${card.name} · ${card.set_name} #${card.number}`;
}

// Raw copies only. A graded row is a different market, and on the API it is a
// different plan: a bigger bot gives slabs their own command.
export function raw(quotes: readonly Price[]): Price[] {
  return quotes.filter((q) => q.grading === null);
}

// A source can hold several LOW rows for the same card: one per printing, and an older one next to
// a fresher one. The reply shows the most recent, so a July figure never sits under a September one.
function newest(rows: readonly Price[]): Price | undefined {
  return rows.reduce<Price | undefined>((best, q) => (best === undefined || q.as_of > best.as_of ? q : best), undefined);
}

export function europe(quotes: readonly Price[]): string {
  const low = raw(quotes).filter((q) => q.source === 'CARDMARKET' && q.variant === 'LOW');
  const perLocale = [...new Set(low.map((q) => q.locale))].flatMap((l) => newest(low.filter((q) => q.locale === l)) ?? []);
  const rows = perLocale
    .sort((a, b) => LOCALES.indexOf(a.locale ?? '') - LOCALES.indexOf(b.locale ?? ''));
  if (rows.length === 0) return NO_QUOTE;
  const lines = rows.map(
    (q) => `${(q.locale ?? '??').toUpperCase()} ${q.amount.toFixed(2)} ${q.currency} · ${q.basis.toLowerCase()} · ${q.as_of}`,
  );
  return `${lines.join('\n')}\nCardmarket, lowest asking price per print language`;
}

export function unitedStates(quotes: readonly Price[]): string {
  const q = newest(raw(quotes).filter((row) => row.source === 'TCGPLAYER' && row.variant === 'LOW'));
  return q ? `${q.amount.toFixed(2)} ${q.currency} · ${q.basis.toLowerCase()} · ${q.as_of} · ${q.provenance}` : NO_QUOTE;
}

export function footer(index: CardPrices['index']): string {
  return `${index ? `Index ${index.eur.toFixed(2)} EUR · ${index.as_of}` : 'No index for this card'} · ${CREDIT}`;
}

export function art(card: Pick<Card, 'images'>): string | undefined {
  const image = card.images?.find((i) => i.size === 'LARGE') ?? card.images?.[0];
  return image?.url;
}
