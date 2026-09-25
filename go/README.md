# `/price` with discordgo and the Go SDK

Two files: `main.go` (Discord plumbing, the command, the autocomplete) and `format.go` (the strings
the embed is built from, shared contract with the TypeScript and Python bots, tested in
`format_test.go`).

```bash
cp .env.example .env   # fill in the four variables
set -a; . ./.env; set +a
go run .
```

Windows PowerShell:

```powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$k" -Value $v }
go run .
```

Tests and checks, as the CI runs them:

```bash
gofmt -l . && go vet ./... && go test -race ./...
```

Setup, the API key and the Discord application: [../README.md](../README.md).
