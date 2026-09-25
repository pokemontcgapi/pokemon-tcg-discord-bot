// A Discord /price command for Pokémon cards, with the TypeScript SDK.
//
// Three decisions, explained in ../README.md:
//   1. autocomplete picks the printing, so the handler receives a card id;
//   2. two markets, two fields, no arithmetic: EUR and USD stay apart;
//   3. card and prices are two independent calls, so they run in parallel.

import { Client, EmbedBuilder, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { PokemonTcgApi, RateLimitedError } from '@pokemontcgapi/sdk';
import { art, europe, footer, raw, title, unitedStates } from './format.ts';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`);
  return value;
}

const api = new PokemonTcgApi({ apiKey: env('PTCG_API_KEY') });
const bot = new Client({ intents: [GatewayIntentBits.Guilds] });

// One command, one option, with autocomplete: the user picks a printing before
// the command runs, so the handler receives a card id and never has to guess.
const price = new SlashCommandBuilder()
  .setName('price')
  .setDescription('EUR and USD quotes for a card')
  .addStringOption((o) => o.setName('card').setDescription('Card name').setRequired(true).setAutocomplete(true));

// Guild commands appear immediately; global ones take up to an hour to propagate.
await new REST({ version: '10' }).setToken(env('DISCORD_TOKEN')).put(
  Routes.applicationGuildCommands(env('DISCORD_APP_ID'), env('DISCORD_GUILD_ID')),
  { body: [price.toJSON()] },
);

bot.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    const typed = interaction.options.getFocused();
    if (typed.length < 2) return interaction.respond([]);
    const page = await api.cards.search({
      q: `name:${typed}*`,
      orderBy: '-release_date',
      limit: 25,
      select: ['id', 'name', 'number', 'set_name'],
    });
    // Discord gives autocomplete 3 seconds; a late answer is an expired interaction, not a reason to crash.
    return interaction
      .respond(page.data.map((c) => ({ name: `${c.name} · ${c.set_name} #${c.number}`.slice(0, 100), value: c.id })))
      .catch(() => undefined);
  }
  if (!interaction.isChatInputCommand() || interaction.commandName !== 'price') return;

  await interaction.deferReply();
  const id = interaction.options.getString('card', true);
  try {
    const [card, prices] = await Promise.all([api.cards.get(id, { include: ['images'] }), api.prices.card(id)]);
    const quotes = raw(prices.data.quotes);
    const embed = new EmbedBuilder()
      .setTitle(title(card))
      .addFields({ name: 'Europe', value: europe(quotes) }, { name: 'United States', value: unitedStates(quotes) })
      .setFooter({ text: footer(prices.data.index) });
    const image = art(card);
    if (image) embed.setThumbnail(image);
    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    // The one line worth copying: a rate-limited user learns how long to wait, straight from the 429.
    const retry = err instanceof RateLimitedError ? ` Try again in ${err.retryAfter ?? 1} s.` : '';
    await interaction.editReply(`Could not price ${id}.${retry}`);
  }
});

bot.once('clientReady', () => console.log(`Logged in as ${bot.user?.tag}. Type /price in your server.`));
await bot.login(env('DISCORD_TOKEN'));
