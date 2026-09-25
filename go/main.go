// A Discord /price command for Pokémon cards, with the Go SDK.
//
// Three decisions, explained in ../README.md:
//  1. autocomplete picks the printing, so the handler receives a card id;
//  2. two markets, two fields, no arithmetic: EUR and USD stay apart;
//  3. card and prices are two independent calls, so they run in parallel.
package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"time"

	"github.com/bwmarrin/discordgo"
	"github.com/pokemontcgapi/sdk-go"
)

func env(name string) string {
	value := os.Getenv(name)
	if value == "" {
		log.Fatalf("%s is not set. Copy .env.example to .env and load it (see README.md).", name)
	}
	return value
}

func main() {
	api := pokemontcgapi.New(pokemontcgapi.WithAPIKey(env("PTCG_API_KEY")))
	token, appID, guildID := env("DISCORD_TOKEN"), env("DISCORD_APP_ID"), env("DISCORD_GUILD_ID")

	session, err := discordgo.New("Bot " + token)
	if err != nil {
		log.Fatal(err)
	}
	// Slash commands need no privileged intent: Guilds is enough.
	session.Identify.Intents = discordgo.IntentsGuilds

	session.AddHandler(func(s *discordgo.Session, i *discordgo.InteractionCreate) {
		switch i.Type {
		case discordgo.InteractionApplicationCommandAutocomplete:
			autocomplete(api, s, i)
		case discordgo.InteractionApplicationCommand:
			if i.ApplicationCommandData().Name == "price" {
				price(api, s, i)
			}
		}
	})
	session.AddHandler(func(s *discordgo.Session, r *discordgo.Ready) {
		log.Printf("Logged in as %s. Type /price in your server.", r.User.String())
	})

	if err := session.Open(); err != nil {
		log.Fatal(err)
	}
	defer session.Close()

	// One command, one option, with autocomplete: the user picks a printing before
	// the command runs, so the handler receives a card id and never has to guess.
	// Guild commands appear immediately; global ones take up to an hour to propagate.
	_, err = session.ApplicationCommandBulkOverwrite(appID, guildID, []*discordgo.ApplicationCommand{{
		Name:        "price",
		Description: "EUR and USD quotes for a card",
		Options: []*discordgo.ApplicationCommandOption{{
			Type:         discordgo.ApplicationCommandOptionString,
			Name:         "card",
			Description:  "Card name",
			Required:     true,
			Autocomplete: true,
		}},
	}})
	if err != nil {
		log.Fatal(err)
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
}

func autocomplete(api *pokemontcgapi.Client, s *discordgo.Session, i *discordgo.InteractionCreate) {
	typed := i.ApplicationCommandData().Options[0].StringValue()
	choices := []*discordgo.ApplicationCommandOptionChoice{}
	if len(typed) >= 2 {
		// Discord gives autocomplete 3 seconds; a late answer is an expired interaction, not a reason to crash.
		ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
		defer cancel()
		page, err := api.Cards.Search(ctx, &pokemontcgapi.CardListParams{
			Q:       "name:" + typed + "*",
			OrderBy: "-release_date",
			Limit:   25,
			Select:  []string{"id", "name", "number", "set_name"},
		})
		if err == nil {
			for _, c := range page.Data {
				choices = append(choices, &discordgo.ApplicationCommandOptionChoice{Name: truncate(title(&c), 100), Value: c.ID})
			}
		}
	}
	_ = s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionApplicationCommandAutocompleteResult,
		Data: &discordgo.InteractionResponseData{Choices: choices},
	})
}

func price(api *pokemontcgapi.Client, s *discordgo.Session, i *discordgo.InteractionCreate) {
	// Discord gives an interaction three seconds; deferring buys fifteen minutes.
	if err := s.InteractionRespond(i.Interaction, &discordgo.InteractionResponse{
		Type: discordgo.InteractionResponseDeferredChannelMessageWithSource,
	}); err != nil {
		return
	}
	id := i.ApplicationCommandData().Options[0].StringValue()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// The card (title and art) and the prices are two independent calls: run them in parallel.
	var (
		card      *pokemontcgapi.Card
		prices    *pokemontcgapi.PricesResponse[pokemontcgapi.CardPrices]
		cardErr   error
		pricesErr error
		wg        sync.WaitGroup
	)
	wg.Add(2)
	go func() {
		defer wg.Done()
		card, cardErr = api.Cards.Get(ctx, id, &pokemontcgapi.CardGetParams{Include: []string{"images"}})
	}()
	go func() {
		defer wg.Done()
		prices, pricesErr = api.Prices.Card(ctx, id, nil)
	}()
	wg.Wait()

	if err := errors.Join(cardErr, pricesErr); err != nil {
		// The one line worth copying: a rate-limited user learns how long to wait, straight from the 429.
		var limited *pokemontcgapi.RateLimitedError
		text := fmt.Sprintf("Could not price %s.", id)
		if errors.As(err, &limited) {
			wait := 1
			if limited.HasRetryAfter {
				wait = int(limited.RetryAfter.Seconds())
			}
			text += fmt.Sprintf(" Try again in %d s.", wait)
		}
		_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Content: &text})
		return
	}

	quotes := raw(prices.Data.Quotes)
	embed := &discordgo.MessageEmbed{
		Title: title(card),
		Fields: []*discordgo.MessageEmbedField{
			{Name: "Europe", Value: europe(quotes)},
			{Name: "United States", Value: unitedStates(quotes)},
		},
		Footer: &discordgo.MessageEmbedFooter{Text: footer(prices.Data.Index)},
	}
	if url := art(card); url != "" {
		embed.Thumbnail = &discordgo.MessageEmbedThumbnail{URL: url}
	}
	_, _ = s.InteractionResponseEdit(i.Interaction, &discordgo.WebhookEdit{Embeds: &[]*discordgo.MessageEmbed{embed}})
}

func truncate(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}
