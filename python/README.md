# `/price` with discord.py and the Python SDK

Two files: `bot.py` (Discord plumbing, the command, the autocomplete) and `quotes.py` (the strings
the embed is built from, shared contract with the TypeScript and Go bots, tested in `test_quotes.py`).

```bash
python -m venv .venv && . .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                            # fill in the four variables
```

Load the `.env` and run:

```bash
set -a; . ./.env; set +a
python bot.py
```

Windows PowerShell:

```powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#].*=' } | ForEach-Object { $k, $v = $_ -split '=', 2; Set-Item -Path "Env:$k" -Value $v }
python bot.py
```

Tests and checks, as the CI runs them:

```bash
pip install -r requirements-dev.txt
ruff check . && ruff format --check . && mypy && pytest
```

Setup, the API key and the Discord application: [../README.md](../README.md).
