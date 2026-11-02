import { useCallback, useEffect, useState } from 'react';
import { fail, finish, startMinihra } from './minihra-protokol';
import { resolveStages } from './config';
import { Puzzle } from './Puzzle';
import { Summary, averageScore } from './Summary';
import type { GameConfig, RoundResult } from './types';

export default function App() {
  const [stages, setStages] = useState<GameConfig[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    // Every INIT (also a repeated one) starts a new game from the beginning.
    startMinihra((level, payload) => {
      try {
        const result = resolveStages(level, payload);
        if (!result.ok) {
          fail(result.code, result.message);
          setStages(null);
          setFailed(true);
          return;
        }
        setStages(result.stages);
        setFailed(false);
        setStage(0);
        setResults([]);
        setGameKey((k) => k + 1);
      } catch (e) {
        fail('INTERNAL', e instanceof Error ? e.message : String(e));
        setStages(null);
        setFailed(true);
      }
    });
  }, []);

  const onRoundEnd = useCallback((result: RoundResult) => {
    setResults((r) => [...r, result]);
    setStage((s) => s + 1);
  }, []);

  if (failed) return <div className="status">Zadání hry se nepodařilo načíst.</div>;
  if (!stages) return <div className="status">Načítám…</div>;

  // Giving up ends the whole game, so only a solved round moves on to the next one.
  const gaveUp = results.some((r) => r.outcome === 'gaveUp');
  const config = gaveUp ? undefined : stages[stage];
  if (!config) {
    const onContinue = () => {
      const score = averageScore(stages, results);
      finish(score / 100, {
        game: stages[0].gameName,
        level: stages[stages.length - 1].level,
        result: results.length === stages.length && results.every((r) => r.outcome === 'solved') ? 'solved' : 'gaveUp',
        score,
        rounds: stages.map((s, i) => {
          const r = results[i];
          return {
            level: s.level,
            name: s.roundName,
            result: r ? r.outcome : 'notPlayed',
            pieces: s.pieceCount,
            placed: r?.placed ?? 0,
            timeSec: r?.timeSec ?? 0,
            score: r?.score ?? 0,
          };
        }),
      });
    };
    return <Summary stages={stages} results={results} onContinue={onContinue} />;
  }
  return (
    <Puzzle
      key={`${gameKey}-${stage}`}
      config={config}
      hasNext={stage < stages.length - 1}
      onRoundEnd={onRoundEnd}
    />
  );
}
