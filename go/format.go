package main

// The reply contract, shared by every bot in this repository: the TypeScript
// and Python versions print byte-identical strings from the same fixtures, and
// the tests in each language assert it. Change one, change all three.

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pokemontcgapi/sdk-go"
)

// One Cardmarket row per print language: an English copy and a French copy of
// the same card are two listings, not one price. The trial plan serves the
// English row only and says so in meta.withheld.
var locales = []string{"en", "de", "fr", "es", "it", "pt", "ja", "zh", "ko"}

const noQuote = "no quote today"

func title(card *pokemontcgapi.Card) string {
	return fmt.Sprintf("%s · %s #%s", card.Name, card.SetName, card.Number)
}

// raw keeps the ungraded rows only. A graded row is a different market, and on
// the API it is a different plan: a bigger bot gives slabs their own command.
func raw(quotes []pokemontcgapi.Price) []pokemontcgapi.Price {
	var out []pokemontcgapi.Price
	for _, q := range quotes {
		if q.Grading == nil {
			out = append(out, q)
		}
	}
	return out
}

func locale(q pokemontcgapi.Price) string {
	if q.Locale == nil {
		return ""
	}
	return *q.Locale
}

func europe(quotes []pokemontcgapi.Price) string {
	var rows []pokemontcgapi.Price
	for _, q := range raw(quotes) {
		if q.Source == "CARDMARKET" && q.Variant == "LOW" {
			rows = append(rows, q)
		}
	}
	if len(rows) == 0 {
		return noQuote
	}
	slices.SortStableFunc(rows, func(a, b pokemontcgapi.Price) int {
		return slices.Index(locales, locale(a)) - slices.Index(locales, locale(b))
	})
	lines := make([]string, 0, len(rows)+1)
	for _, q := range rows {
		code := locale(q)
		if code == "" {
			code = "??"
		}
		lines = append(lines, fmt.Sprintf("%s %.2f %s · %s · %s", strings.ToUpper(code), q.Amount, q.Currency, strings.ToLower(q.Basis), q.AsOf))
	}
	lines = append(lines, "Cardmarket, lowest asking price per print language")
	return strings.Join(lines, "\n")
}

func unitedStates(quotes []pokemontcgapi.Price) string {
	for _, q := range raw(quotes) {
		if q.Source == "TCGPLAYER" {
			return fmt.Sprintf("%.2f %s · %s · %s · %s", q.Amount, q.Currency, strings.ToLower(q.Basis), q.AsOf, q.Provenance)
		}
	}
	return noQuote
}

func footer(index *pokemontcgapi.PriceIndex) string {
	if index == nil {
		return "No index for this card"
	}
	return fmt.Sprintf("Index %.2f EUR · %s", index.EUR, index.AsOf)
}

func art(card *pokemontcgapi.Card) string {
	for _, i := range card.Images {
		if i.Size == "LARGE" {
			return i.URL
		}
	}
	if len(card.Images) > 0 {
		return card.Images[0].URL
	}
	return ""
}
