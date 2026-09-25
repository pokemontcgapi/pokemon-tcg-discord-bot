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

test('footer carries the composite index with its date, or says there is none', () => {
  assert.equal(footer(prices.data.index), 'Index 556.23 EUR · 2026-09-02');
  assert.equal(footer(null), 'No index for this card');
});
