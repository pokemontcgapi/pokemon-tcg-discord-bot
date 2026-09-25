# Create the Discord application

Three values from the [Discord Developer Portal](https://discord.com/developers/applications) and
one from your Discord client. Ten minutes the first time.

## 1. The application and the bot token

1. Open the [Developer Portal](https://discord.com/developers/applications) and click **New
   Application**. Name it (the name is what users see next to the reply).
2. On **General Information**, copy the **Application ID** into `DISCORD_APP_ID`.
3. Open the **Bot** tab and click **Reset Token**. Copy the token into `DISCORD_TOKEN`. It is shown
   once; if you lose it, reset it again.
4. Leave every **Privileged Gateway Intent** off. The bots use slash commands, which need only the
   Guilds intent, and that one is not privileged.

## 2. Invite the bot to your server

On **OAuth2 → URL Generator** tick the scopes `bot` and `applications.commands`, and under bot
permissions tick **Send Messages** and **Embed Links**. Open the generated URL and pick the server.
The same link, with your application id filled in:

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&scope=bot%20applications.commands&permissions=18432
```

`18432` is Send Messages plus Embed Links. Slash-command replies do not strictly need channel
permissions, but the pair keeps the bot usable if you add a prefix command later.

## 3. The server id

The examples register the command on one guild, because guild commands appear immediately while
global ones take up to an hour to propagate. To get the id: in Discord, **User Settings → Advanced →
Developer Mode** on, then right-click the server icon → **Copy Server ID**. Put it in
`DISCORD_GUILD_ID`.

When the bot is ready for many servers, switch the registration call from the guild route to the
global one (`Routes.applicationCommands(appId)` in discord.js, `tree.sync()` without a guild in
discord.py, an empty guild id in discordgo) and give Discord an hour.

## 4. Run it

Copy `.env.example` to `.env` in the folder of the language you chose and fill in the four
variables. The [README](../README.md#quick-start) has the run command for each. When the process
prints `Logged in as …`, type `/` in a channel of that server: the command is in the list.

## If the command does not show up

- The bot was invited without the `applications.commands` scope: re-open the invite link from step 2.
- The wrong server id: the command is registered on the guild in `DISCORD_GUILD_ID`, not on every
  server the bot is in.
- The Discord client caches the command list: press Ctrl+R (Cmd+R on macOS) in the client.
- The reply says "Could not price …": the API key is missing or wrong; check
  [get-an-api-key.md](./get-an-api-key.md) and the process's log.
