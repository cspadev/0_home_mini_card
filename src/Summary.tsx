import type { GameConfig, RoundResult } from './types';

function formatSeconds(sec: number) {
  const total = Math.floor(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Rounds the player never reached (the game ended by giving up) count as 0. */
export function averageScore(stages: GameConfig[], results: RoundResult[]) {
  const sum = stages.reduce((acc, _, i) => acc + (results[i]?.score ?? 0), 0);
  return Math.round(sum / stages.length);
}

export function Summary({
  stages,
  results,
  onContinue,
}: {
  stages: GameConfig[];
  results: RoundResult[];
  onContinue: () => void;
}) {
  const average = averageScore(stages, results);
  return (
    <div className="game summary">
      <div className="summary-card">
        <h2>Souhrn hry</h2>
        <table>
          <thead>
            <tr>
              <th>Kolo</th>
              <th>Dílky</th>
              <th>Čas</th>
              <th>Skóre</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, i) => {
              const r = results[i];
              return (
                <tr key={stage.level}>
                  <td>
                    {stage.roundName}
                    {r?.outcome === 'gaveUp' && <small> (vzdáno)</small>}
                  </td>
                  {r ? (
                    <>
                      <td>
                        {r.placed}/{r.pieces}
                      </td>
                      <td>{formatSeconds(r.timeSec)}</td>
                      <td>{r.score}</td>
                    </>
                  ) : (
                    <>
                      <td colSpan={2}>
                        <small>nehráno</small>
                      </td>
                      <td>0</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Průměr</td>
              <td>{average}</td>
            </tr>
          </tfoot>
        </table>
        <button type="button" className="btn" onClick={onContinue}>
          Pokračovat
        </button>
      </div>
    </div>
  );
}
