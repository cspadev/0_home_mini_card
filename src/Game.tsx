import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import { computeLayout, type Layout } from './layout';
import { clamp } from './math';
import { Piece } from './Piece';
import { computeScore } from './score';
import { initState, reducer } from './gameState';
import type { GameConfig, LoadedImage, PieceShape, PieceState, RoundResult } from './types';

interface Props {
  config: GameConfig;
  image: LoadedImage;
  shapes: PieceShape[];
  /** True when the game continues with another round after this one is solved. */
  hasNext: boolean;
  onRoundEnd: (result: RoundResult) => void;
}

interface Drag {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
  moved: boolean;
  t: number;
}

const DRAG_THRESHOLD = 6;
const TAP_MAX_MS = 500;

function screenPos(shape: PieceShape, p: PieceState, L: Layout, solved: boolean) {
  const s = L.s;
  if (solved) return { x: L.board.x + shape.x * s, y: L.board.y + shape.y * s };
  const pw = shape.w * s;
  const ph = shape.h * s;
  return {
    x: clamp(L.tray.x + p.fx * Math.max(1, L.tray.w - pw), 0, Math.max(0, L.w - pw)),
    y: clamp(L.tray.y + p.fy * Math.max(1, L.tray.h - ph), 0, Math.max(0, L.h - ph)),
  };
}

function formatTime(ms: number) {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function elapsedMs(startedAt: number | null, finishedAt: number | null, now: number) {
  if (startedAt === null) return 0;
  return (finishedAt ?? Math.max(now, startedAt)) - startedAt;
}

/** Owns the ticking state so the per-second re-render does not touch the playfield. */
function Clock({ startedAt, finishedAt }: { startedAt: number | null; finishedAt: number | null }) {
  const [now, setNow] = useState(() => performance.now());
  const running = startedAt !== null && finishedAt === null;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [running]);
  return <>{formatTime(elapsedMs(startedAt, finishedAt, now))}</>;
}

const CONFETTI_COUNT = 36;
// One piece per horizontal slot (11 is coprime with 36, so colours mix) keeps both sides evenly covered.
const CONFETTI = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
  left: (((i * 11) % CONFETTI_COUNT) + Math.random()) * (100 / CONFETTI_COUNT),
  delay: Math.random() * 0.8,
  duration: 2 + Math.random() * 2,
  color: ['#ffcc00', '#ffffff', '#4da3ff', '#ff6b6b'][i % 4],
}));

export function Game({ config, image, shapes, hasNext, onRoundEnd }: Props) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [dragId, setDragId] = useState<number | null>(null);
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initState(shapes, config.rotation),
  );

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => (size.w > 0 ? computeLayout(size.w, size.h, image.w, image.h) : null),
    [size, image],
  );

  const ended = state.finishedAt !== null;
  const solved = state.outcome === 'solved';
  const rotation = config.rotation;
  const total = shapes.length;
  const finalMs = elapsedMs(state.startedAt, state.finishedAt, 0);
  // A solved round scores by time; otherwise only the share of correctly placed pieces counts, below the minimum score.
  const scorePct = ended
    ? Math.round(
        (solved
          ? computeScore(finalMs / 1000, config.expectedTimeSec, config.maxTimeSec, config.minScore)
          : (state.placed / total) * config.minScore),
      )
    : null;
  // Giving up ends the whole game, so only a solved round leads to another one.
  const continues = solved && hasNext;

  // Pointer handlers read the latest state through this ref so they can stay referentially stable.
  const latest = useRef({ state, layout });
  useLayoutEffect(() => {
    latest.current = { state, layout };
  });

  // `override` carries the just-dropped/rotated piece, whose state update has not rendered yet.
  const countPlaced = useCallback(
    (override?: { id: number; x: number; y: number; turns: number }) => {
      const { state, layout } = latest.current;
      if (!layout) return 0;
      return state.pieces.filter((p) => {
        const shape = shapes[p.id];
        const o = override && override.id === p.id ? override : null;
        const turns = o ? o.turns : p.turns;
        const pos = o ?? screenPos(shape, p, layout, false);
        const tx = layout.board.x + shape.x * layout.s;
        const ty = layout.board.y + shape.y * layout.s;
        const tolerance = Math.max(8, config.snapDistance * Math.min(shape.w, shape.h) * layout.s);
        return turns % 4 === 0 && Math.hypot(pos.x - tx, pos.y - ty) <= tolerance;
      }).length;
    },
    [shapes, config.snapDistance],
  );

  const checkSolved = useCallback(
    (override: { id: number; x: number; y: number; turns: number }) => {
      const placed = countPlaced(override);
      if (placed === shapes.length) dispatch({ type: 'end', outcome: 'solved', placed, now: performance.now() });
    },
    [countPlaced, shapes.length],
  );

  // confirm() is unavailable in an iframe, so the confirmation is an in-page dialog.
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  const onGiveUp = () => {
    setConfirmGiveUp(false);
    drag.current = null;
    setDragId(null);
    dispatch({ type: 'end', outcome: 'gaveUp', placed: countPlaced(), now: performance.now() });
  };

  const onContinue = () => {
    if (scorePct === null || state.outcome === null) return;
    onRoundEnd({
      level: config.level,
      name: config.roundName,
      outcome: state.outcome,
      pieces: total,
      placed: state.placed,
      timeSec: Math.round(finalMs / 100) / 10,
      score: scorePct,
    });
  };

  const onDown = useCallback((e: PointerEvent<HTMLDivElement>, id: number) => {
    const { state, layout } = latest.current;
    if (!layout || state.finishedAt !== null || drag.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = screenPos(shapes[id], state.pieces[id], layout, false);
    drag.current = {
      id,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: pos.x,
      originY: pos.y,
      x: pos.x,
      y: pos.y,
      moved: false,
      t: performance.now(),
    };
    dispatch({ type: 'raise', id, now: performance.now() });
  }, [shapes]);

  const onMove = useCallback((e: PointerEvent<HTMLDivElement>, id: number) => {
    const d = drag.current;
    const { layout } = latest.current;
    if (!d || d.id !== id || d.pointerId !== e.pointerId || !layout || latest.current.state.finishedAt !== null) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      setDragId(id);
    }
    const shape = shapes[id];
    const pw = shape.w * layout.s;
    const ph = shape.h * layout.s;
    d.x = clamp(d.originX + dx, 0, Math.max(0, layout.w - pw));
    d.y = clamp(d.originY + dy, 0, Math.max(0, layout.h - ph));
    dispatch({
      type: 'move',
      id,
      fx: (d.x - layout.tray.x) / Math.max(1, layout.tray.w - pw),
      fy: (d.y - layout.tray.y) / Math.max(1, layout.tray.h - ph),
    });
  }, [shapes]);

  const onUp = useCallback(
    (e: PointerEvent<HTMLDivElement>, id: number, cancelled: boolean) => {
      const d = drag.current;
      if (!d || d.id !== id || d.pointerId !== e.pointerId) return;
      drag.current = null;
      setDragId(null);
      if (latest.current.state.finishedAt !== null) return;

      const turns = latest.current.state.pieces[id].turns;
      if (d.moved) {
        checkSolved({ id, x: d.x, y: d.y, turns });
      } else if (rotation && !cancelled && performance.now() - d.t < TAP_MAX_MS) {
        dispatch({ type: 'rotate', id });
        checkSolved({ id, x: d.x, y: d.y, turns: turns + 1 });
      }
    },
    [rotation, checkSolved],
  );

  const imageUrl = `url("${image.url}")`;

  return (
    <div className="game">
      <header className="hud">
        <div className="hud-title">
          <span className="logo" aria-hidden />
          <div>
            <h1>{config.gameTitle}</h1>
            <span className="badge" style={config.badgeColor ? { background: config.badgeColor } : undefined}>
              {config.roundName}
            </span>
          </div>
        </div>
        <div className="hud-stats">
          <div className="chip">
            <span>Dílky</span>
            <strong>{shapes.length}</strong>
          </div>
          <div className="chip">
            <span>Čas</span>
            <strong>
              <Clock startedAt={state.startedAt} finishedAt={state.finishedAt} />
            </strong>
          </div>
        </div>
      </header>

      <div className="field" ref={fieldRef}>
        {layout && (
          <>
            <div
              className="tray"
              style={{ left: layout.tray.x, top: layout.tray.y, width: layout.tray.w, height: layout.tray.h }}
            />

            <div
              className="board"
              style={{ left: layout.board.x, top: layout.board.y, width: layout.board.w, height: layout.board.h }}
            >
              {config.background && <div className="ghost" style={{ backgroundImage: imageUrl }} />}
            </div>

            <div
              className={`reveal${solved ? ' on' : ''}`}
              style={{
                left: layout.board.x,
                top: layout.board.y,
                width: layout.board.w,
                height: layout.board.h,
                backgroundImage: imageUrl,
              }}
            />

            {state.pieces.map((p) => {
              const pos = screenPos(shapes[p.id], p, layout, solved);
              return (
                <Piece
                  key={p.id}
                  shape={shapes[p.id]}
                  image={image}
                  s={layout.s}
                  x={pos.x}
                  y={pos.y}
                  turns={p.turns}
                  z={p.z}
                  placed={solved}
                  dragging={dragId === p.id}
                  onDown={onDown}
                  onMove={onMove}
                  onUp={onUp}
                />
              );
            })}
          </>
        )}
      </div>
      <footer className={`hint${rotation ? ' hint-rotate' : ''}`}>
        <span className="hint-text">
          {rotation && (
            <span className="hint-icon" aria-hidden>
              ↻
            </span>
          )}
          {config.hint}
        </span>
        <button type="button" className="giveup" onClick={() => setConfirmGiveUp(true)} disabled={ended}>
          Vzdát se
        </button>
      </footer>

      {confirmGiveUp && !ended && (
        <div className="confirm" role="alertdialog" aria-modal="true" aria-labelledby="giveup-title">
          <div className="confirm-card">
            <h2 id="giveup-title">Určitě chcete hru vzdát?</h2>
            <div className="confirm-actions">
              <button type="button" className="btn btn-danger" onClick={onGiveUp}>
                Ano
              </button>
              <button type="button" className="btn" onClick={() => setConfirmGiveUp(false)} autoFocus>
                Ne
              </button>
            </div>
          </div>
        </div>
      )}

      {ended && (
        <div className={`win${solved ? '' : ' instant'}`}>
          {solved && (
            <div className="confetti" aria-hidden>
              {CONFETTI.map((c, i) => (
                <i
                  key={i}
                  style={{
                    left: `${c.left}%`,
                    background: c.color,
                    animationDelay: `${c.delay}s`,
                    animationDuration: `${c.duration}s`,
                  }}
                />
              ))}
            </div>
          )}
          <div className="win-card">
            <h2>{solved ? 'Hotovo!' : 'Vzdáno'}</h2>
            <div className="score">
              {scorePct}
              <small>/100</small>
            </div>
            <p>
              Na místě {state.placed} z {total} dílků
            </p>
            <p>Čas {formatTime(finalMs)}</p>
            <button type="button" className="btn" onClick={onContinue}>
              {continues ? 'Další kolo' : 'Souhrn'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
