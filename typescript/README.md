# `/price` with discord.js and the TypeScript SDK

Two files: `bot.ts` (Discord plumbing, the command, the autocomplete) and `format.ts` (the strings
the embed is built from, shared contract with the Python and Go bots, tested in `format.test.ts`).

```bash
npm install
cp .env.example .env   # fill in the four variables
npm start              # node --env-file=.env --experimental-strip-types bot.ts
```

Node 22.6 or newer runs the `.ts` file directly; on Node 23.6+ the flag is no longer needed and can
be dropped from `package.json`.

Tests and checks, as the CI runs them:

```bash
npm run typecheck && npm test
```

This is the bot from [the article](https://pokemontcgapi.com/blog/discord-price-bot-typescript-sdk?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=typescript_readme),
with the formatting moved to its own file so it can be tested. Setup, the API key and the Discord
application: [../README.md](../README.md).
