# `/ask` with Claude and the pokemontcgapi MCP server

One file, `bot.ts`. At startup it spawns the MCP server (`npx -y @pokemontcgapi/mcp`), reads its
tool list and hands every tool to Claude as a callable function. `/ask <question>` runs a tool loop
(search a card, read its prices, list a set) and replies with a short answer that keeps the source,
basis and date of every figure, because the tool results carry them.

```bash
npm install
cp .env.example .env   # the four bot variables plus ANTHROPIC_API_KEY
npm start
```

Try: `/ask what is a Japanese Umbreon alt art worth in Europe right now?` or
`/ask which Base Set holos cost under 50 EUR?`

What to know before pointing it at a busy server:

- Every tool call spends API credits exactly like the `/price` bots (1 for a search, 2 for prices),
  plus Claude tokens for the question and the tool results. The model is one constant at the top of
  `bot.ts`; it runs at low effort, which is enough when the tools do the work.
- The photo tool (`ptcg_identify_card_from_image`) is filtered out of the tool list: the bot has no
  photo to send, and that call costs 25 credits every time.
- The system prompt forbids a price the model did not read from a tool, and asks it to name the
  printing it priced when several match. Read the answer as a summary of tool results, not as a
  market opinion.
- A refused request (safety classifiers) is re-run on a fallback model inside the same call, so the
  user still gets an answer; if the whole chain refuses, the bot says so in one line.

Typecheck, as the CI runs it: `npm run typecheck`. Setup, the API key and the Discord application:
[../README.md](../README.md). The same MCP server in Claude Desktop, Claude Code, Cursor and VS Code:
[pokemontcgapi.com/mcp](https://pokemontcgapi.com/mcp?utm_source=github&utm_medium=readme&utm_campaign=discord_bot&utm_content=mcp_readme).
