# Pokémon TCG Discord bot: card prices in EUR and USD

[![CI](https://github.com/pokemontcgapi/pokemon-tcg-discord-bot/actions/workflows/ci.yml/badge.svg)](https://github.com/pokemontcgapi/pokemon-tcg-discord-bot/actions/workflows/ci.yml) [![license](https://img.shields.io/github/license/pokemontcgapi/pokemon-tcg-discord-bot)](./LICENSE)

A Discord bot that answers `/price <card>` with the European and the American figure for a Pokémon
card, side by side, each with its source and its date: Cardmarket in EUR, TCGplayer in USD, the
composite index in the footer and the card art as a thumbnail. Autocomplete picks the exact printing
while the user types, so "Charizard" never has to be guessed.

The same bot is written four times, so you can start from the language you already use:

| Folder | Stack | Command it adds |
|---|---|---|
| [`typescript/`](./typescript) | [discord.js](https://discord.js.org) + [`@pokemontcgapi/sdk`](https://www.npmjs.com/package/@pokemontcgapi/sdk) | `/price` |
| [`python/`](./python) | [discord.py](https://discordpy.readthedocs.io) + [`pokemontcgapi`](https://pypi.org/project/pokemontcgapi/) | `/price` |
| [`go/`](./go) | [discordgo](https://github.com/bwmarrin/discordgo) + [`github.com/pokemontcgapi/sdk-go`](https://pkg.go.dev/github.com/pokemontcgapi/sdk-go) | `/price` |
| [`mcp/`](./mcp) | discord.js + Claude + the [`@pokemontcgapi/mcp`](https://www.npmjs.com/package/@pokemontcgapi/mcp) server as its tools | `/ask <question>` |

The data comes from the [Pokémon TCG API](https://pokemontcgapi.com/?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme): every card in the
international, Japanese and Simplified Chinese print lines, with prices that state their source,
basis, grade and date. The [trial key](https://pokemontcgapi.com/free-api-key?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme) is free, needs no
credit card, and covers building the bot and running it on a small server.

Unofficial. Not produced, endorsed, supported by or affiliated with Nintendo, Creatures Inc.,
GAME FREAK inc. or The Pokémon Company International. Pokémon and all related marks are trademarks of
their respective owners.

## What the reply looks like

The embed below is what the tests in every language build from the shared fixture (a dated
snapshot, so the figures are old on purpose; a live reply carries today's dates):

```
Charizard · Base #4
Europe
  EN 599.90 EUR · asking · 2026-09-01
  Cardmarket, lowest asking price per print language
United States
  510.00 USD · guide · 2026-07-30 · TCGplayer
Index 556.23 EUR · 2026-09-02 · Prices via pokemontcgapi.com
```

The last line credits the data source. If you run a copy of the bot, keep it: it is how the people
in your server find where the numbers come from, and it is the only thing asked in return for the
code.

Nothing is converted and nothing is averaged. Each line prints the basis (an asking price on
Cardmarket, a guide figure on TCGplayer) and the day the figure is for, because a number without
those two things is an opinion, and a bot that states opinions with two decimals gets argued with in
chat.

## Quick start

1. **Get an API key**: the form at [pokemontcgapi.com/free-api-key](https://pokemontcgapi.com/free-api-key?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme)
   takes an email and a password and gives you the key on the spot. Copy it before you close the
   tab, then confirm the email to raise the trial to 800 credits. Step by step, with the curl
   alternative and what the trial does and does not include: [docs/get-an-api-key.md](./docs/get-an-api-key.md).
2. **Create the Discord application**: bot token, application id, invite link and the id of the
   server you test in: [docs/create-the-discord-app.md](./docs/create-the-discord-app.md).
3. **Pick a language** and run it. Each folder has a `.env.example`; copy it to `.env` and fill in
   the four variables (`DISCORD_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID`, `PTCG_API_KEY`).

### TypeScript

Node 22.6 or newer (the start script runs the `.ts` file directly, no build step).

```bash
cd typescript
npm install
cp .env.example .env   # fill it in
npm start
```

### Python

Python 3.10 or newer.

```bash
cd python
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env   # fill it in
set -a; . ./.env; set +a; python bot.py         # Windows PowerShell: see python/README.md
```

### Go

Go 1.23 or newer.

```bash
cd go
cp .env.example .env   # fill it in
set -a; . ./.env; set +a; go run .
```

### MCP + Claude

Node 22.6 or newer and an [Anthropic API key](https://platform.claude.com) in `ANTHROPIC_API_KEY`
next to the four variables above.

```bash
cd mcp
npm install
cp .env.example .env   # fill it in
npm start
```

Type `/price` (or `/ask` for the MCP bot) in the server you registered. Guild commands appear
immediately; global commands take up to an hour to propagate, which is why the examples register on
one guild.

## The three decisions, the same in every language

**Autocomplete picks the printing, not the handler.** "Charizard" is not a card. It is a few hundred
cards across thirty years of sets, and the one the user means is almost never the one a name search
returns first. So the command never receives a name. While the user types, the autocomplete handler
runs a prefix search (`name:chari*`), newest release first, and offers up to twenty-five choices
labelled with the set and the collector number. The value the command finally receives is a card id,
and everything after that is a lookup, not a guess.

**Two markets, two fields, no arithmetic.** The Cardmarket rows in EUR go under "Europe", one line
per print language (an English copy and a French copy of the same card are two listings with two
prices); the TCGplayer row in USD goes under "United States"; the footer carries the composite index
in EUR with its date. Graded rows are filtered out on purpose: a PSA 10 median under a "Europe"
heading would be wrong twice, it is a different market and on this API a different plan. A bigger bot
gives slabs their own command. [How the price rows are built](https://pokemontcgapi.com/blog/how-we-compute-eur-and-usd-card-prices?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme)
is its own article.

**Two calls in parallel, and a reply that survives errors.** The command needs the card (title and
art) and the prices. They are two independent requests, so they run concurrently (`Promise.all`,
`asyncio.gather`, two goroutines). Discord gives an interaction three seconds before it expires;
deferring the reply buys fifteen minutes, and the two calls come back well inside the first second
on a warm connection. The error path does one thing worth copying: a rate-limited user is told how
long to wait, straight from the `Retry-After` the SDK parsed off the 429.

## The same reply in every language

The strings the embed is built from live in one small module per language (`format.ts`,
`quotes.py`, `format.go`) and are tested against the same fixtures in `testdata/fixtures`, shared
with the SDKs. A change to the contract is a change to three files and three test suites, on
purpose: whoever reads the Python bot after the TypeScript one should recognise every line.

```bash
cd typescript && npm test
cd python && pip install -r requirements-dev.txt && pytest
cd go && go test ./...
```

## What it costs to run

Credits per interaction, from the route costs on the [pricing page](https://pokemontcgapi.com/pricing?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme)
as of 2026-09-25:

| Interaction | Calls | Credits |
|---|---|---|
| One autocomplete keystroke (after two characters) | card search | 1 |
| One `/price` answer | card lookup + current prices | 3 |
| A quiet server, 50 lookups a day | about 150 searches and 100 calls | about 300 a day |

The trial key carries 800 credits with a 400-a-day cap and ends 30 days after signup, with one
difference you will see in the embed: it serves the English Cardmarket row only, and `meta.withheld`
on the price response says `non_english_locales`. The other print languages, the graded rows and a
server that stays busy want a paid plan; the pricing page has the monthly allowances.

Autocomplete is the part that adds up, because it fires on every keystroke after the second. Two
cheap improvements if the server is busy: ignore focused values shorter than three characters, and
keep a small in-process cache keyed by the typed prefix for a minute. The
[Discord bot use case](https://pokemontcgapi.com/use-cases/discord-bot?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme) shows the same command with
plain `fetch` and ETags, where a revalidated lookup answers `304` for free.

`/ask` in the MCP bot costs the same API credits per tool call, plus the Claude tokens of the
question and the tool results; the model is one constant at the top of `mcp/bot.ts`.

## The MCP bot

`mcp/bot.ts` spawns the [pokemontcgapi MCP server](https://pokemontcgapi.com/mcp?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme) once, reads its
tool list, and hands every tool to Claude as a callable function. A question like *"what is a
Japanese Umbreon alt art worth in Europe right now?"* becomes one or more tool calls (search, then
prices) and a short answer that keeps the source, basis and date of every figure, because the tool
results carry them. The system prompt forbids a price the model did not read from a tool. The photo
tool is left out: the bot has no photo to send, and that call costs 25 credits every time.

The same server works in Claude Desktop, Claude Code, Cursor and VS Code without a bot in between:
the [MCP page](https://pokemontcgapi.com/mcp?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme) has the one-line configuration for each.

## FAQ

**Does the bot need the Message Content intent?** No. It uses slash commands, so the only gateway
intent is Guilds. Prefix commands such as `!price` would need the privileged Message Content intent
and a review once the bot is in many servers; slash commands avoid both.

**Why does the reply sometimes say "no quote today" for a market?** Because no source observed that
printing on that market recently enough to serve. The row is absent rather than zero, and the other
market or the index in the footer may still be present. The [coverage page](https://pokemontcgapi.com/coverage?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme)
reports how many price rows a probe card returns per region.

**Can I run this on Cloudflare Workers or Bun?** The SDKs can. A gateway bot needs a long-lived
connection, so the bot process itself belongs on a small always-on host. An HTTP-interactions bot
without a gateway library would run on Workers.

**Where is the API key allowed to live?** In the bot's environment, never in a message or an embed.
A key that leaks in chat is a key you rotate at [pokemontcgapi.com/account](https://pokemontcgapi.com/account?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme).

## Further reading

- [The SDK page](https://pokemontcgapi.com/sdk?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme): every method with the route it wraps, in the three languages.
- [A Discord price bot with the TypeScript SDK](https://pokemontcgapi.com/blog/discord-price-bot-typescript-sdk?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme): the article the `typescript/` bot comes from.
- [Give your AI agent card prices with MCP](https://pokemontcgapi.com/blog/give-your-ai-agent-card-prices-with-mcp?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme): how the MCP server is built.
- [API documentation](https://pokemontcgapi.com/docs?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme) and the [OpenAPI file](https://pokemontcgapi.com/openapi.json?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=readme).

## License

MIT. The bots are examples: copy them, rename them, ship them.
