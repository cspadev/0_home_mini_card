# Skládání karty

Jigsaw-style puzzle game: the player reassembles a "broken" image (by default a public health insurance card) from Voronoi-shaped pieces. Built with React, TypeScript and Vite; designed to run inside an iframe of a host application. Works with mouse and touch.

## Game configuration

`game.config.json` holds a list of games; the first one is the default. Each game is a sequence of rounds. Edit the file to change games, rounds, pictures or texts; no code changes are needed.

| Game field | Meaning |
|---|---|
| `name` | identifier used to start the game (`payload.game`) |
| `title` | user-facing game name shown in the header |
| `texts.hint` / `texts.hintRotate` | footer instruction; `hintRotate` is shown (highlighted) on rounds with rotation |
| `rounds` | played in order; every round is scored and the final score is their average |

| Round field | Meaning |
|---|---|
| `name` | user-facing round name shown in the badge |
| `badgeColor` | optional CSS colour of the badge |
| `image` | picture to assemble: a file under `img/` (e.g. `img/karta.png`), an absolute path (`/x.jpg` from `public/`) or an `http(s)` URL |
| `cardTemplate` | optional empty card the host-supplied `name` is written onto |
| `pieces` | number of pieces (4-40) |
| `rotation` | pieces start rotated and a tap rotates them |
| `background` | show a faded copy of the picture behind the pieces |
| `expectedTimeSec`, `maxTimeFactor`, `minScore`, `snapDistance` | scoring and tolerance (max time = expected time x factor) |

Shipped games: `karticka` (easy 8 pieces with background, medium 16 pieces, hard 12 pieces with rotation) and `pasovka` (photo `public/pasovka.jpg`: easy 6 pieces, hard 12 pieces with rotation).

To add a game, append an object to `games` with its own `name`, `title`, `texts` and `rounds`, put the pictures in `img/` or `public/` and reference them in each round's `image`.

## Game flow

- The host names a game in `payload.game`; an unknown or missing name starts the first game.
- `level` (1 to the number of rounds of the game, default: the last round) is the last round played; all rounds up to it are played in order, e.g. `karticka` level 2 = Lehká, then Střední. An invalid `level` is replaced by the default.
- An explicit piece count (`pieceCount`) applies to every round; `imageUrl` replaces every round's picture. The time, score and snap overrides apply only to the last round; earlier rounds use their own settings, scaled by piece count.
- Rounds with `rotation` start with rotated pieces; tap/click a piece to rotate it by 90 degrees.
- Every round is scored. When a round ends, the player sees its score and continues with **Další kolo**; after the last round a summary table lists the score of every round and their average, and **Pokračovat** sends the one and only `FINISH` with that average.
- Every round has a **Vzdát se** button that opens a confirmation popup ("Určitě chcete hru vzdát?"). Confirming ends the whole game: the round gets its give-up score, the remaining rounds are listed as not played and count as 0 in the average.

Pieces do not snap or lock. The puzzle is solved when every piece is within the snap distance of its correct spot and upright.

## Development

Requires Node.js 20.19 or newer.

```powershell
npm ci          # install exactly what package-lock.json specifies
npm run dev     # http://localhost:5173
npm run build   # type-check + production build into dist/
```

Standalone (outside an iframe) the game takes `level` and `payload` from the URL, as the author guide describes:

`/?level=2&payload={"pieceCount":16}`

Messages that would be sent to the host are logged to the console instead. `/dev/host-test.html` embeds the game in an iframe, answers `READY` with `INIT` and logs what the game sends back.

## Host integration (iframe)

Protocol version 1 (see `universal-specification.md`), implemented in `src/minihra-protokol.ts`. Messages use `window.postMessage`.

| Direction | Message |
|---|---|
| game -> host | `{ type: "READY", version: 1 }` sent on load |
| host -> game | `{ type: "INIT", version: 1, level?, payload? }`; a new `INIT` restarts the game |
| game -> host | `{ type: "FINISH", version: 1, successRate, succesRate, payload }` |
| game -> host | `{ type: "ERROR", version: 1, code, message }` |

Until `INIT` arrives the game shows "Načítám…". Without `level` and `payload` it starts with defaults.

### `level`

1 to the number of rounds of the game (`karticka`: 1 Lehká, 2 Střední, 3 Těžká). Default: the last round. All rounds up to the chosen level are played and scored.

### `payload` (input)

An object (anything else is answered with `ERROR` `INVALID_PAYLOAD`), all fields optional. Invalid or out-of-range values are replaced by the defaults; unknown fields are ignored.

| Field | Range | Default |
|---|---|---|
| `game` | name from `game.config.json` | first game |
| `pieceCount` | 4–40 | the round's `pieces` |
| `imageUrl` | `http(s)` URL | the round's `image` |
| `name` | text written onto the card | none |
| `expectedTimeSec` | 1–3600 s | the round's value, scaled by piece count |
| `maxTimeSec` | above `expectedTimeSec`, up to 3600 s | expected time x the round's factor |
| `minScore` | 0–100 | the round's value |
| `snapDistance` | 0.02–0.5 | the round's value |

`expectedTimeSec`, `maxTimeSec`, `minScore` and `snapDistance` apply to the last round only.

### `successRate` and output `payload`

- `successRate` is the average of the round scores divided by 100. The average is taken over all rounds of the game (rounds not played after giving up count as 0) and rounded to a whole number, like the displayed round scores.
- Round score, solved: see Scoring below. The player gave up: `placedPieces / pieces * minScore`, i.e. never more than a solved puzzle would give.

Output `payload`: `{ game, level, result, score, rounds }` where `level` is the last round, `result` is `solved` if every round was solved, otherwise `gaveUp`, `score` the average (0–100) and `rounds` an array of `{ level, name, result, pieces, placed, timeSec, score }` with `result` `solved`, `gaveUp` or `notPlayed`.

### Scoring

100 up to the expected time, then a linear fall-off to `minScore` at the max time; `minScore` after that. Per-round defaults (pieces, expected time, max time factor, min score, snap distance) are in `game.config.json`.

## Using a different image

Put the file in `public/` and pass `imageUrl` (e.g. `/name.jpg`) in the payload. Remote URLs must be `http(s)` and allow cross-origin loading. To change a round's picture, edit `image` in `game.config.json`.

## Security

- Set `VITE_ALLOWED_PARENT_ORIGINS` (see `.env.example`) to the host's origin. Messages from other origins are ignored and replies are sent only to the host's origin. Without it, any parent is accepted.
- Also send `Content-Security-Policy: frame-ancestors <host origin>` when deploying so only the host can embed the game.
- Supply chain: `.npmrc` disables dependency install scripts, pins exact versions and ignores package versions published in the last 7 days. Use `npm ci` and review lockfile changes. `npm audit` is clean at the time of writing.

## Deployment (Vercel)

Static site: build command `npm run build`, output directory `dist`. Set `VITE_ALLOWED_PARENT_ORIGINS` as an environment variable.

## Structure

```
src/App.tsx               round sequence, per-round results, final FINISH
src/Summary.tsx           final table of round scores and their average
src/minihra-protokol.ts   postMessage in/out (READY, INIT, FINISH, ERROR)
src/config.ts             reads game.config.json, INIT validation
game.config.json          games, rounds, texts
src/fracture.ts           Voronoi fracture of the image
src/gameState.ts          reducer: piece positions, rotation, end of round
src/Game.tsx              drag, rotate, completion/give up, HUD
src/Piece.tsx             clipped, rotatable piece
src/score.ts              scoring
```
