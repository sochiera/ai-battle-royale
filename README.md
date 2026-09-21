# Orły-Wro: Bitwa (ai-battle-royale)

Przeglądarkowa gra PvP „battle royale" (motyw orły-wro) — autorytatywny serwer Node.js + WebSocket, klient Canvas 2D. Produkcja: **https://orlywro.pro/game/** (VPS Contabo, `173.249.29.245`).

## Struktura

| Katalog | Co |
|---|---|
| `game/` | Klient gry (statyka: Canvas 2D, input, net, render) |
| `game-server/` | Autorytatywny serwer gry (Node ≥18, `ws`), API host/join/rejoin, rankingi, rate-limity |
| `site/` | Strona orlywro.pro (podstrony: adam, druh, franek, ignacy, mati + galeria) |
| `deploy/` | Nginx (vhost produkcyjny + snippety gry) i systemd unit |

## Serwer gry — lokalnie

```bash
cd game-server
npm install
npm start          # nasłuch na 127.0.0.1:8502
# gra: http://localhost:8502/game/   health: http://localhost:8502/healthz
```

Symulacja 8 klientów (QA): `npm run bots`.

Konfiguracja przez zmienne środowiskowe (`src/config.js`): `HOST`, `PORT`, `STATIC_DIR`, `DATA_DIR`, `MATCH_DURATION`, limity rate (`HOST_RATE_MAX`, `JOIN_RATE_MAX`, `REJOIN_RATE_MAX`, `WS_MAX_PER_IP`).

## Wdrożenie produkcyjne (VPS)

- Kod: `/home/ubuntu/orlywro-game` (to repo bez `site/`), statyka strony: `/var/www/orlywro`
- Usługa: `orlywro-game.service` → node `game-server/src/index.js` na `127.0.0.1:8502` (`NODE_ENV=production`, `DATA_DIR=/home/ubuntu/orlywro-game-data`)
- Nginx: vhost `orlywro.pro` (`deploy/orlywro.vhost.live`) — `/game/` statyka, `/api/` i `/ws` → proxy 8502, `/healthz`
- HTTPS: Certbot (`orlywro.pro`, `www`)
- Rankingi (JSON) trwale w `/home/ubuntu/orlywro-game-data` — poza repo

Aktualizacja:

```bash
git pull --ff-only
sudo systemctl restart orlywro-game
curl -fsS http://127.0.0.1:8502/healthz
```

Rollback: `git checkout <poprzedni-SHA> && sudo systemctl restart orlywro-game`.

## Test bezpieczeństwa (na serwerze)

```bash
bash deploy/test-security.sh   # 12x zły kod → oczekiwane 400/404/429, potem poprawny host → 200
```

## Uwaga

Klucze SSH i sekrety **nie** trafiają do repo (patrz `.gitignore`).
