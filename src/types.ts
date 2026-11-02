/** One round of a game as written in game.config.json. Image paths are relative to the project root. */
export interface RoundDefinition {
  /** User-facing round name. */
  name: string;
  /** CSS colour of the round's badge. */
  badgeColor?: string;
  image: string;
  /** Empty card the host-supplied name is written onto; omit to disable personalisation. */
  cardTemplate?: string;
  pieces: number;
  rotation: boolean;
  /** Show a faded copy of the picture behind the pieces. */
  background: boolean;
  expectedTimeSec: number;
  /** The max time is `expectedTimeSec * maxTimeFactor`. */
  maxTimeFactor: number;
  minScore: number;
  snapDistance: number;
}

export interface GameDefinition {
  /** Identifier the host or URL uses to start the game. */
  name: string;
  /** User-facing game name. */
  title: string;
  texts: { hint: string; hintRotate: string };
  /** Played in order; every round is scored and the final score is their average. */
  rounds: RoundDefinition[];
}

/** Structure of game.config.json; the first game is the default. */
export interface GamesFile {
  games: GameDefinition[];
}

export interface CardName {
  first: string;
  last: string;
}

export interface GameConfig {
  /** `name` of the game definition. */
  gameName: string;
  /** 1-based index of the round in the game. */
  level: number;
  gameTitle: string;
  roundName: string;
  badgeColor: string | null;
  rotation: boolean;
  background: boolean;
  hint: string;
  pieceCount: number;
  imageUrl: string;
  /** Name written onto the round's card template; null when absent or when a custom image is used. */
  cardName: CardName | null;
  cardTemplateUrl: string | null;
  expectedTimeSec: number;
  /** At or beyond this time the score is `minScore`. */
  maxTimeSec: number;
  /** Lowest score awarded (0-100). */
  minScore: number;
  /** Max distance from the correct spot that counts as placed, as a fraction of the piece's smaller side. */
  snapDistance: number;
}

/** Result of one finished round. */
export interface RoundResult {
  level: number;
  name: string;
  outcome: 'solved' | 'gaveUp';
  pieces: number;
  placed: number;
  timeSec: number;
  /** 0-100, rounded. */
  score: number;
}

/** Static geometry of one piece, in image pixels. */
export interface PieceShape {
  id: number;
  /** Bounding box of the Voronoi cell. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** CSS clip-path polygon relative to the bounding box. */
  clip: string;
  /** Centroid relative to the bounding box; rotation pivot. */
  ox: number;
  oy: number;
}

export interface PieceState {
  id: number;
  /** Clockwise quarter turns; kept cumulative so animations never spin backwards. */
  turns: number;
  /** Position as a fraction of the tray's free range (may leave 0..1 when dropped over the board). */
  fx: number;
  fy: number;
  z: number;
}

export interface LoadedImage {
  url: string;
  w: number;
  h: number;
}
