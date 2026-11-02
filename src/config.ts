import definition from '../game.config.json';
import type { CardName, GameConfig, GameDefinition, GamesFile, RoundDefinition } from './types';

const games = (definition as GamesFile).games;

const bundledAssets = import.meta.glob('../img/**/*', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

/** Resolves an image path from game.config.json: a project-relative file (e.g. img/karta.png), an absolute path or an http(s) URL. */
function assetUrl(path: string): string {
  return bundledAssets[`../${path}`] ?? path;
}

function safeImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const u = new URL(value, window.location.href);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/** One word is the given name; otherwise the first word is the given name and the rest the surname. */
function parseName(value: unknown): CardName | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 80).toLocaleUpperCase('cs');
  if (!name) return null;
  const space = name.indexOf(' ');
  return space < 0 ? { first: name, last: '' } : { first: name.slice(0, space), last: name.slice(space + 1) };
}

function toNumber(value: unknown): number | null {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** A number within [lo, hi], otherwise null so the caller falls back to the default. */
function inRange(value: unknown, lo: number, hi: number): number | null {
  const n = toNumber(value);
  return n !== null && n >= lo && n <= hi ? n : null;
}

/** Only the requested (last) round takes the time, score and snap overrides from the host; earlier rounds use their own settings. Invalid values fall back to defaults. */
function buildConfig(game: GameDefinition, round: RoundDefinition, raw: Record<string, unknown>, overridable: boolean): Omit<GameConfig, 'gameName' | 'level'> {
  const count = inRange(raw.pieceCount, 4, 40);
  const pieceCount = count !== null ? Math.round(count) : round.pieces;
  const scale = pieceCount / round.pieces;

  const time = overridable ? inRange(raw.expectedTimeSec, 1, 3600) : null;
  const expectedTimeSec = time ?? round.expectedTimeSec * scale;
  const max = overridable ? toNumber(raw.maxTimeSec) : null;
  const maxTimeSec = max !== null && max > expectedTimeSec && max <= 3600 ? max : expectedTimeSec * round.maxTimeFactor;
  const min = overridable ? inRange(raw.minScore, 0, 100) : null;
  const snap = overridable ? inRange(raw.snapDistance, 0.02, 0.5) : null;
  const customImage = safeImageUrl(raw.imageUrl);
  const cardTemplateUrl = round.cardTemplate ? assetUrl(round.cardTemplate) : null;

  return {
    gameTitle: game.title,
    roundName: round.name,
    badgeColor: round.badgeColor ?? null,
    rotation: round.rotation,
    background: round.background,
    hint: round.rotation ? game.texts.hintRotate : game.texts.hint,
    pieceCount,
    imageUrl: customImage ?? assetUrl(round.image),
    cardName: customImage || !cardTemplateUrl ? null : parseName(raw.name),
    cardTemplateUrl,
    expectedTimeSec,
    maxTimeSec,
    minScore: min !== null ? Math.round(min) : round.minScore,
    snapDistance: snap ?? round.snapDistance,
  };
}

export type InitResult = { ok: true; stages: GameConfig[] } | { ok: false; code: 'INVALID_PAYLOAD'; message: string };

/**
 * Accepts untrusted input from INIT and returns the rounds to play; every round is scored.
 * `level` (1 .. number of rounds, default: the last) is the last round played; the earlier rounds are played first.
 * A missing payload means defaults; a payload that is not an object is rejected.
 */
export function resolveStages(level: number | undefined, payload: unknown): InitResult {
  if (payload !== undefined && payload !== null && (typeof payload !== 'object' || Array.isArray(payload))) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'payload musí být objekt.' };
  }
  const raw = (payload ?? {}) as Record<string, unknown>;
  const requested = typeof raw.game === 'string' ? raw.game : null;
  const game = games.find((g) => g.name === requested) ?? games[0];
  const valid = level !== undefined && Number.isInteger(level) && level >= 1 && level <= game.rounds.length;
  const last = valid ? level : game.rounds.length;
  const stages = game.rounds
    .slice(0, last)
    .map((round, i) => ({
      ...buildConfig(game, round, raw, i === last - 1),
      gameName: game.name,
      level: i + 1,
    }));
  return { ok: true, stages };
}
