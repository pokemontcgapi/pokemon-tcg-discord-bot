package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/pokemontcgapi/sdk-go"
)

// In the public repository the fixtures sit in ../testdata/fixtures; in the monorepo they are packages/fixtures.
var candidates = []string{filepath.Join("..", "testdata", "fixtures"), filepath.Join("..", "..", "fixtures")}

func fixture(t *testing.T, name string, into any) {
	t.Helper()
	for _, dir := range candidates {
		data, err := os.ReadFile(filepath.Join(dir, name+".json"))
		if err != nil {
			continue
		}
		var doc struct {
			Body json.RawMessage `json:"body"`
		}
		if err := json.Unmarshal(data, &doc); err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(doc.Body, into); err != nil {
			t.Fatal(err)
		}
		return
	}
	t.Fatalf("fixture %s not found in %v", name, candidates)
}

func prices(t *testing.T) *pokemontcgapi.PricesResponse[pokemontcgapi.CardPrices] {
	t.Helper()
	var resp pokemontcgapi.PricesResponse[pokemontcgapi.CardPrices]
	fixture(t, "prices-card-withheld", &resp)
	return &resp
}

func TestTitleIsNameSetAndCollectorNumber(t *testing.T) {
	got := title(&pokemontcgapi.Card{Name: "Charizard", SetName: "Base", Number: "4"})
	if got != "Charizard · Base #4" {
		t.Fatalf("got %q", got)
	}
}

func TestEuropeListsTheCardmarketRowsPerPrintLanguage(t *testing.T) {
	got := europe(raw(prices(t).Data.Quotes))
	want := "EN 599.90 EUR · asking · 2026-09-01\nCardmarket, lowest asking price per print language"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestUnitedStatesIsTheTCGplayerRowWithItsProvenance(t *testing.T) {
	got := unitedStates(raw(prices(t).Data.Quotes))
	if got != "510.00 USD · guide · 2026-07-30 · TCGplayer" {
		t.Fatalf("got %q", got)
	}
}

func TestGradedRowsNeverReachAMarketField(t *testing.T) {
	graded := prices(t).Data.Quotes[0]
	graded.Source = "CARDMARKET"
	graded.Grading = &pokemontcgapi.Grading{Company: "PSA", Score: "10"}
	graded.Amount = 9999
	if got := europe(raw([]pokemontcgapi.Price{graded})); got != noQuote {
		t.Fatalf("europe: got %q", got)
	}
	graded.Source = "TCGPLAYER"
	if got := unitedStates(raw([]pokemontcgapi.Price{graded})); got != noQuote {
		t.Fatalf("unitedStates: got %q", got)
	}
}

func TestTheMostRecentLowRowWins(t *testing.T) {
	// The shape seen live on bs-4 on 2026-09-25: a July holofoil row first, a September row after it,
	// and MARKET rows that are not the lowest price.
	base := prices(t).Data.Quotes[0]
	row := func(source, variant string, amount float64, currency, asOf string) pokemontcgapi.Price {
		q := base
		q.Source, q.Variant, q.Amount, q.Currency, q.AsOf = source, variant, amount, currency, asOf
		if source == "TCGPLAYER" {
			q.Provenance, q.Basis = "TCGplayer", "GUIDE"
		}
		return q
	}
	quotes := []pokemontcgapi.Price{
		row("TCGPLAYER", "LOW", 510, "USD", "2026-07-30"),
		row("TCGPLAYER", "MARKET", 944.53, "USD", "2026-09-24"),
		row("TCGPLAYER", "LOW", 449.99, "USD", "2026-09-24"),
		row("CARDMARKET", "LOW", 520, "EUR", "2026-09-01"),
		row("CARDMARKET", "LOW", 499.99, "EUR", "2026-09-24"),
	}
	if got := unitedStates(quotes); got != "449.99 USD · guide · 2026-09-24 · TCGplayer" {
		t.Fatalf("unitedStates: got %q", got)
	}
	want := "EN 499.99 EUR · asking · 2026-09-24\nCardmarket, lowest asking price per print language"
	if got := europe(quotes); got != want {
		t.Fatalf("europe: got %q", got)
	}
}

func TestFooterCarriesTheIndexWithItsDateOrSaysThereIsNone(t *testing.T) {
	if got := footer(prices(t).Data.Index); got != "Index 556.23 EUR · 2026-09-02" {
		t.Fatalf("got %q", got)
	}
	if got := footer(nil); got != "No index for this card" {
		t.Fatalf("got %q", got)
	}
}
