import { useEffect, useState } from 'react';
import { renderCard } from './cardImage';
import { fracture, loadImage } from './fracture';
import { Game } from './Game';
import { fail } from './minihra-protokol';
import type { GameConfig, LoadedImage, PieceShape, RoundResult } from './types';

type Data = { image: LoadedImage; shapes: PieceShape[] } | 'error' | null;

export function Puzzle({ config, hasNext, onRoundEnd }: { config: GameConfig; hasNext: boolean; onRoundEnd: (result: RoundResult) => void }) {
  const [data, setData] = useState<Data>(null);

  useEffect(() => {
    let cancelled = false;
    (config.cardName && config.cardTemplateUrl
      ? renderCard(config.cardName, config.cardTemplateUrl)
      : Promise.resolve(config.imageUrl))
      .then(loadImage)
      .then((image) => {
        if (!cancelled) {
          setData({ image, shapes: fracture(image.w, image.h, config.pieceCount) });
        }
      })
      .catch(() => {
        if (cancelled) return;
        fail('INTERNAL', 'Obrázek se nepodařilo načíst.');
        setData('error');
      });
    return () => {
      cancelled = true;
    };
  }, [config.imageUrl, config.cardName, config.cardTemplateUrl, config.pieceCount]);

  if (data === 'error') return <div className="status">Obrázek se nepodařilo načíst.</div>;
  if (!data) return <div className="status">Načítání…</div>;
  return <Game config={config} image={data.image} shapes={data.shapes} hasNext={hasNext} onRoundEnd={onRoundEnd} />;
}
