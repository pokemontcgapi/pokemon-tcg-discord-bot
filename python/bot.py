"""A Discord /price command for Pokémon cards, with the Python SDK.

Three decisions, explained in ../README.md:
  1. autocomplete picks the printing, so the handler receives a card id;
  2. two markets, two fields, no arithmetic: EUR and USD stay apart;
  3. card and prices are two independent calls, so they run in parallel.
"""

from __future__ import annotations

import asyncio
import os

import discord
from discord import app_commands
from pokemontcgapi import AsyncPokemonTcgApi, PokemonTcgApiError, RateLimitedError

from quotes import art, europe, footer, raw, title, united_states


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is not set. Copy .env.example to .env and load it (see README.md).")
    return value


api = AsyncPokemonTcgApi(env("PTCG_API_KEY"))
GUILD = discord.Object(id=int(env("DISCORD_GUILD_ID")))


class Bot(discord.Client):
    def __init__(self) -> None:
        # Slash commands need no privileged intent: Guilds is enough, and it is in the default set.
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self) -> None:
        # Guild commands appear immediately; global ones take up to an hour to propagate.
        self.tree.copy_global_to(guild=GUILD)
        await self.tree.sync(guild=GUILD)


bot = Bot()


# One command, one option, with autocomplete: the user picks a printing before
# the command runs, so the handler receives a card id and never has to guess.
@bot.tree.command(name="price", description="EUR and USD quotes for a card")
@app_commands.describe(card="Card name")
async def price(interaction: discord.Interaction, card: str) -> None:
    # Discord gives an interaction three seconds; defer buys fifteen minutes.
    await interaction.response.defer()
    try:
        card_row, prices = await asyncio.gather(api.cards.get(card, include=["images"]), api.prices.card(card))
        quotes = raw(prices["data"]["quotes"])
        embed = discord.Embed(title=title(card_row))
        embed.add_field(name="Europe", value=europe(quotes), inline=False)
        embed.add_field(name="United States", value=united_states(quotes), inline=False)
        embed.set_footer(text=footer(prices["data"]["index"]))
        image = art(card_row)
        if image:
            embed.set_thumbnail(url=image)
        await interaction.followup.send(embed=embed)
    except RateLimitedError as err:
        # The one line worth copying: a rate-limited user learns how long to wait, straight from the 429.
        await interaction.followup.send(f"Could not price {card}. Try again in {err.retry_after or 1} s.")
    except PokemonTcgApiError:
        await interaction.followup.send(f"Could not price {card}.")


@price.autocomplete("card")
async def card_autocomplete(interaction: discord.Interaction, current: str) -> list[app_commands.Choice[str]]:
    if len(current) < 2:
        return []
    try:
        page = await api.cards.search(
            q=f"name:{current}*", order_by="-release_date", limit=25, select=["id", "name", "number", "set_name"]
        )
    except PokemonTcgApiError:
        # Autocomplete has three seconds; a failed search is an empty list, not a crash.
        return []
    return [
        app_commands.Choice(name=f"{c['name']} · {c['set_name']} #{c['number']}"[:100], value=c["id"])
        for c in page.data
    ]


@bot.event
async def on_ready() -> None:
    print(f"Logged in as {bot.user}. Type /price in your server.")


bot.run(env("DISCORD_TOKEN"))
