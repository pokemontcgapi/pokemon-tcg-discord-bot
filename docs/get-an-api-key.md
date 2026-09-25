# Get a free API key on pokemontcgapi.com

The bots authenticate with one header, `X-Api-Key`, and the SDKs send it for you once the key is in
`PTCG_API_KEY`. This page is how to get that key, in two minutes, with no credit card.

## 1. Fill in the form

Open [pokemontcgapi.com/free-api-key](https://pokemontcgapi.com/free-api-key) and enter an email
and a password.

- The password is not for the API. The key authenticates on its own. The password is what signs you
  back in at [pokemontcgapi.com/account](https://pokemontcgapi.com/account) to see what you have
  spent, rotate the key or upgrade.
- The key appears on the page as soon as the form is submitted. There is no confirmation link to wait
  for before you can use it.

## 2. Copy the key now

The site stores only a hash of the key. The signup response is kept for 24 hours so the same request
can be replayed, and after that the secret is gone: if you lose it, sign in and rotate the key, which
gives you a new one and revokes the old.

Put it in the bot's `.env` next to the Discord variables:

```
PTCG_API_KEY=your-key
```

Never paste it in a Discord message or an embed. A key that leaks in chat is a key you rotate.

## 3. Confirm the email

The account starts with 80 credits. Confirming the address the site emails you raises the trial to
**800 credits**, with a cap of 400 a day, and the trial ends **30 days** after signup. That is
roughly 250 `/price` answers plus the autocomplete searches around them (the cost table is in the
[README](../README.md#what-it-costs-to-run)).

## What the trial includes, and what it does not

- The whole catalogue: cards, sets, illustrators and images across the international, Japanese and
  Simplified Chinese print lines, and current prices for every card.
- Cardmarket serves the **English print row only** on the trial. The price response says so in
  `meta.withheld` (`non_english_locales`), and the bot's "Europe" field shows one line instead of
  one per language.
- Graded rows (PSA, BGS, CGC) are withheld as well; the bots filter them out anyway.
- Card recognition from a photo: 5 calls after the email is confirmed, then it is a Growth feature.

After the trial, or for a server that stays busy, the [pricing page](https://pokemontcgapi.com/pricing)
has the monthly plans, starting at 29 EUR a month.

## The same signup from the terminal

If you would rather not use the form, the API creates the account too. Generate an
`Idempotency-Key` once and keep it with the request:

```bash
IDEM=$(uuidgen)
curl -s -X POST "https://api.pokemontcgapi.com/v1/accounts/free" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEM" \
  -d '{"email":"you@example.com"}'
```

The key comes back in `data.key.secret`. Repeating the exact same request (same key, same body, same
network) within 24 hours replays the response, secret included. A new `Idempotency-Key` for the same
email returns `409 ACCOUNT_EXISTS`.

## Check that it works

```bash
curl -s "https://api.pokemontcgapi.com/v1/cards/base1-4" -H "X-Api-Key: $PTCG_API_KEY"
```

Charizard from Base Set comes back, with `set_name`, `number`, and the fields the bot's title is
built from. If the reply is `401 INVALID_API_KEY`, the key was copied with a space or a line break.

If the form fails and the terminal route fails too, [info@pokemontcgapi.com](mailto:info@pokemontcgapi.com?subject=API%20key)
issues a key by hand.
