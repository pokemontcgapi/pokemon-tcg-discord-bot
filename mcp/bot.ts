// A Discord /ask command answered by Claude, with the pokemontcgapi MCP server as its tools.
//
// The bot spawns the MCP server (`npx -y @pokemontcgapi/mcp`) once, reads its tool list, and hands
// every tool to Claude as a callable function. A question such as "what is a Japanese Umbreon alt
// art worth in Europe right now?" becomes one or more tool calls and a short answer that keeps the
// source, basis and date of every figure, because the tool results carry them.

import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { Client as McpClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

// One constant to change if you want a different model. Opus 5 at low effort answers a price
// question in a few seconds; the tools do the work, the model writes the sentence.
const MODEL = 'claude-opus-5';
const DISCORD_LIMIT = 2000;
// Where the numbers come from, as Discord subtext under every answer. Keep it if you run a copy.
const CREDIT = '\n-# Prices via pokemontcgapi.com';

const SYSTEM = `You answer questions about Pokémon TCG cards, sets and prices inside a Discord server, using the tools.
Rules:
- Never state a price you did not read from a tool result. Every figure you give carries its source, basis (asking or guide), currency and the as_of date from the tool result.
- EUR figures come from Cardmarket, USD figures from TCGplayer; do not convert or average across currencies.
- If a card name matches several printings, say which one you priced (set and collector number) or ask which one the user means.
- If a tool result starts with a next_step handoff, show that sentence and its URL verbatim and stop.
- Answer in plain Discord markdown, under 1500 characters, no headings.`;

// ── the MCP server, spawned once ────────────────────────────────────────────
const mcp = new McpClient({ name: 'pokemon-tcg-discord-bot', version: '0.1.0' });
await mcp.connect(
  new StdioClientTransport({
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', '@pokemontcgapi/mcp'],
    env: { ...(process.env as Record<string, string>), PTCG_API_KEY: env('PTCG_API_KEY') },
  }),
);

// Every MCP tool becomes a Claude tool: same name, same description, same JSON schema, and a `run`
// that forwards the call. The photo tool is left out: this bot has no photo to send, and that call
// costs 25 credits every time.
const { tools: mcpTools } = await mcp.listTools();
const tools = mcpTools
  .filter((t) => t.name !== 'ptcg_identify_card_from_image')
  .map((t) =>
    betaTool({
      name: t.name,
      description: t.description ?? t.name,
      inputSchema: t.inputSchema as Parameters<typeof betaTool>[0]['inputSchema'],
      run: async (input) => {
        const result = await mcp.callTool({ name: t.name, arguments: input as Record<string, unknown> });
        const blocks = result.content as Array<{ type: string; text?: string }>;
        return blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n') || 'empty result';
      },
    }),
  );
console.log(`MCP server up with ${tools.length} tools: ${tools.map((t) => t.name).join(', ')}`);

// ── Claude ──────────────────────────────────────────────────────────────────
const anthropic = new Anthropic();

async function answer(question: string): Promise<string> {
  const final = await anthropic.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    // A safety refusal is re-run on a fallback model inside the same call, so the user still gets an answer.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    tools,
    max_iterations: 6,
    messages: [{ role: 'user', content: question }],
  });
  if (final.stop_reason === 'refusal') return 'I cannot answer that one.';
  const text = final.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
  return text || 'I found nothing to say. Try naming the card and its set.';
}

// ── Discord ─────────────────────────────────────────────────────────────────
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

const ask = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('Ask about a card, a set or a price')
  .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true));

await new REST({ version: '10' }).setToken(env('DISCORD_TOKEN')).put(
  Routes.applicationGuildCommands(env('DISCORD_APP_ID'), env('DISCORD_GUILD_ID')),
  { body: [ask.toJSON()] },
);

bot.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'ask') return;
  await interaction.deferReply();
  const question = interaction.options.getString('question', true);
  try {
    const text = await answer(question);
    const room = DISCORD_LIMIT - CREDIT.length;
    await interaction.editReply((text.length > room ? `${text.slice(0, room - 1)}…` : text) + CREDIT);
  } catch (err) {
    console.error(err);
    await interaction.editReply('Something went wrong on my side. Try again in a moment.');
  }
});

bot.once('clientReady', () => console.log(`Logged in as ${bot.user?.tag}. Type /ask in your server.`));
await bot.login(env('DISCORD_TOKEN'));
