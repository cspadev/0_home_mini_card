import { memo, type PointerEvent } from 'react';
import type { LoadedImage, PieceShape } from './types';

interface Props {
  shape: PieceShape;
  image: LoadedImage;
  s: number;
  x: number;
  y: number;
  turns: number;
  z: number;
  placed: boolean;
  dragging: boolean;
  onDown: (e: PointerEvent<HTMLDivElement>, id: number) => void;
  onMove: (e: PointerEvent<HTMLDivElement>, id: number) => void;
  onUp: (e: PointerEvent<HTMLDivElement>, id: number, cancelled: boolean) => void;
}

/** Memoised so that dragging one piece does not re-render the others (callbacks must be stable). */
export const Piece = memo(function Piece({
  shape,
  image,
  s,
  x,
  y,
  turns,
  z,
  placed,
  dragging,
  onDown,
  onMove,
  onUp,
}: Props) {
  const cls = ['piece-wrap', placed && 'placed', dragging && 'dragging'].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{
        width: shape.w * s,
        height: shape.h * s,
        zIndex: placed ? 1 : 10 + z,
        transform: `translate(${x}px, ${y}px) rotate(${turns * 90}deg)`,
        transformOrigin: `${shape.ox * s}px ${shape.oy * s}px`,
      }}
    >
      <div
        className="piece"
        style={{
          clipPath: shape.clip,
          backgroundImage: `url("${image.url}")`,
          backgroundSize: `${image.w * s}px ${image.h * s}px`,
          backgroundPosition: `${-shape.x * s}px ${-shape.y * s}px`,
        }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => onDown(e, shape.id)}
        onPointerMove={(e) => onMove(e, shape.id)}
        onPointerUp={(e) => onUp(e, shape.id, false)}
        onPointerCancel={(e) => onUp(e, shape.id, true)}
      />
    </div>
  );
});
