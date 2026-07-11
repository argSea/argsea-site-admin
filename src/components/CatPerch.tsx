// The harbor cat, out on its rounds: one perch per screen now, each with its
// own quips, replacing the single sidebar poke-cat block. A poke swaps in a
// random line (never repeating the one just shown) and it fades after a beat.
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { HarborCat } from './art';

interface Props {
	quips:      string[];
	bubbleSide?: 'left' | 'right';  // which side the speech bubble opens toward
	style?:      CSSProperties;     // positions the perch within its relative parent
}

const BUBBLE_WINDOW = 2600;

export default function CatPerch({ quips, bubbleSide = 'left', style }: Props) {
	const [say, setSay] = useState<string | null>(null);
	const timer = useRef<number>(undefined);

	const poke = () => {
		window.clearTimeout(timer.current);
		const others = quips.filter((q) => q !== say);
		setSay(others.length ? others[Math.floor(Math.random() * others.length)] : quips[0]);
		timer.current = window.setTimeout(() => setSay(null), BUBBLE_WINDOW);
	};

	return (
		<div style={{ position: 'absolute', display: 'inline-flex', zIndex: 3, ...style }}>
			{say && (
				<div style={{
					position: 'absolute', bottom: '100%', marginBottom: 6,
					[bubbleSide === 'left' ? 'right' : 'left']: 0,
					background: 'var(--overlay-card)', border: '1px solid rgba(150,160,220,.35)',
					borderRadius: bubbleSide === 'left' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
					padding: '6px 11px', fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-soft)',
					whiteSpace: 'nowrap', animation: 'bubblePop .2s ease both', zIndex: 5,
				}}>{say}</div>
			)}
			<div className="cat-perch" onClick={poke} title="the harbor cat">
				<HarborCat />
			</div>
		</div>
	);
}
