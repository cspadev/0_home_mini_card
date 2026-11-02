import type { PieceShape, PieceState } from './types';

export type Outcome = 'solved' | 'gaveUp';

export interface GameState {
  pieces: PieceState[];
  zCounter: number;
  startedAt: number | null;
  finishedAt: number | null;
  outcome: Outcome | null;
  /** Pieces upright and on their correct spot when the game ended. */
  placed: number;
}

export type Action =
  | { type: 'raise'; id: number; now: number }
  | { type: 'move'; id: number; fx: number; fy: number }
  | { type: 'rotate'; id: number }
  | { type: 'end'; outcome: Outcome; placed: number; now: number };

export function initState(shapes: PieceShape[], rotation: boolean): GameState {
  const order = shapes.map((s) => s.id);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const cols = Math.ceil(Math.sqrt(shapes.length * 1.5));
  const rows = Math.ceil(shapes.length / cols);

  const pieces = order.map((id, slot): PieceState => {
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    return {
      id,
      turns: rotation ? Math.floor(Math.random() * 4) : 0,
      fx: (col + Math.random()) / cols,
      fy: (row + Math.random()) / rows,
      z: slot,
    };
  });
  pieces.sort((a, b) => a.id - b.id);

  if (rotation && pieces.every((p) => p.turns % 4 === 0)) pieces[0].turns = 1;
  return { pieces, zCounter: pieces.length, startedAt: null, finishedAt: null, outcome: null, placed: 0 };
}

function patch(state: GameState, id: number, fn: (p: PieceState) => PieceState): GameState {
  return { ...state, pieces: state.pieces.map((p) => (p.id === id ? fn(p) : p)) };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'raise': {
      const z = state.zCounter + 1;
      return {
        ...patch(state, action.id, (p) => ({ ...p, z })),
        zCounter: z,
        startedAt: state.startedAt ?? action.now,
      };
    }
    case 'move':
      return patch(state, action.id, (p) => ({ ...p, fx: action.fx, fy: action.fy }));
    case 'rotate':
      return patch(state, action.id, (p) => ({ ...p, turns: p.turns + 1 }));
    case 'end':
      return state.finishedAt === null
        ? {
            ...state,
            startedAt: state.startedAt ?? action.now,
            finishedAt: action.now,
            outcome: action.outcome,
            placed: action.placed,
          }
        : state;
  }
}
