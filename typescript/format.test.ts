import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { CardPrices, Price, PricesResponse } from '@pokemontcgapi/sdk';
import { europe, footer, raw, title, unitedStates } from './format.ts';

const here = dirname(fileURLToPath(import.meta.url));
// In the public repository the fixtures sit in ../testdata/fixtures; in the monorepo they are packages/fixtures.
const candidates = [join(here, '..', 'testdata', 'fixtures'), join(here, '..', '..', 'fixtures')];
const fixture = (name: string): unknown => {
  for (const dir of candidates) {
    try {
      return (JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8')) as { body: unknown }).body;
    } catch {
      /* try the next location */
    }
  }
  throw new Error(`fixture ${name} not found in ${candidates.join(', ')}`);
};

const prices = fixture('prices-card-withheld') as PricesResponse<CardPrices>;
const first = (): Price => {
  const q = prices.data.quotes[0];
  if (!q) throw new Error('fixture has no quotes');
  return q;
};

test('title is name, set and collector number', () => {
  assert.equal(title({ name: 'Charizard', set_name: 'Base', number: '4' }), 'Charizard · Base #4');
});

test('europe lists the Cardmarket rows per print language, with basis and date', () => {
  assert.equal(
    europe(raw(prices.data.quotes)),
    'EN 599.90 EUR · asking · 2026-09-01\nCardmarket, lowest asking price per print language',
  );
});

test('united states is the TCGplayer row with its provenance', () => {
  assert.equal(unitedStates(raw(prices.data.quotes)), '510.00 USD · guide · 2026-07-30 · TCGplayer');
});

test('graded rows never reach a market field', () => {
  const graded: Price = { ...first(), source: 'CARDMARKET', grading: { company: 'PSA', score: '10' }, amount: 9999 };
  assert.equal(europe(raw([graded])), 'no quote today');
  assert.equal(unitedStates(raw([{ ...graded, source: 'TCGPLAYER' }])), 'no quote today');
});

test('the most recent LOW row wins, whatever the order and the variants around it', () => {
  // The shape seen live on bs-4 on 2026-09-25: a July holofoil row first, a September row after it,
  // and MARKET rows that are not the lowest price.
  const base = first();
  const quotes: Price[] = [
    { ...base, source: 'TCGPLAYER', variant: 'LOW', basis: 'GUIDE', amount: 510, currency: 'USD', printing: 'HOLOFOIL', as_of: '2026-07-30', provenance: 'TCGplayer' },
    { ...base, source: 'TCGPLAYER', variant: 'MARKET', basis: 'GUIDE', amount: 944.53, currency: 'USD', printing: null, as_of: '2026-09-24', provenance: 'TCGplayer' },
    { ...base, source: 'TCGPLAYER', variant: 'LOW', basis: 'GUIDE', amount: 449.99, currency: 'USD', printing: null, as_of: '2026-09-24', provenance: 'TCGplayer' },
    { ...base, source: 'CARDMARKET', variant: 'LOW', amount: 520, as_of: '2026-09-01' },
    { ...base, source: 'CARDMARKET', variant: 'LOW', amount: 499.99, as_of: '2026-09-24' },
  ];
  assert.equal(unitedStates(quotes), '449.99 USD · guide · 2026-09-24 · TCGplayer');
  assert.equal(europe(quotes), 'EN 499.99 EUR · asking · 2026-09-24\nCardmarket, lowest asking price per print language');
});

test('footer carries the composite index with its date, or says there is none', () => {
  assert.equal(footer(prices.data.index), 'Index 556.23 EUR · 2026-09-02');
  assert.equal(footer(null), 'No index for this card');
});
