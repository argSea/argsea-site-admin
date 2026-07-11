// The little harbor drawings, traced from the design. All decorative; every
// animation dies under prefers-reduced-motion via the global kill-switch.
import type { CSSProperties } from 'react';

interface MarkProps {
	width?:  number;
	height?: number;
	style?:  CSSProperties;
}

export function LighthouseMark({ width = 24, height = 28, style }: MarkProps) {
	return (
		<svg width={width} height={height} viewBox="0 0 26 30" fill="none" style={style}>
			<path d="M13 2 L17 9 L9 9 Z" fill="#f0d9a8" style={{ animation: 'lampPulse 5s ease-in-out infinite' }} />
			<rect x="10" y="9" width="6" height="14" fill="none" stroke="#93a0e8" strokeWidth="1.4" />
			<path d="M10 13 h6 M10 17 h6" stroke="#93a0e8" strokeWidth="1.4" />
			<path d="M6 27 q7 -4 14 0" stroke="#5f6ec4" strokeWidth="1.4" fill="none" />
		</svg>
	);
}

interface BoatProps extends MarkProps {
	bobDuration?: string;
}

export function Boat({ width = 30, height = 24, bobDuration = '3s', style }: BoatProps) {
	return (
		<svg width={width} height={height} viewBox="0 0 30 24" fill="none"
			style={{ animation: `bobBoat ${bobDuration} ease-in-out infinite`, ...style }}>
			<path d="M4 15 L26 15 L21 22 L9 22 Z" fill="#93a0e8" />
			<path d="M15 15 V3" stroke="#5f6ec4" strokeWidth="1.5" />
			<path d="M15 3 L24 13 L15 13 Z" fill="#f0d9a8" />
		</svg>
	);
}

interface FishProps extends MarkProps {
	flip?: boolean;
}

export function Fish({ width = 20, height = 14, flip = false }: FishProps) {
	const body = flip ? '#5f6ec4' : '#93a0e8';
	const tail = flip ? '#93a0e8' : '#5f6ec4';
	return (
		<svg width={width} height={height} viewBox="0 0 20 14" fill="none">
			<path d="M2 7 C6 2 12 2 16 7 C12 12 6 12 2 7 Z" fill={body} />
			<path d="M16 7 L19 3 L19 11 Z" fill={tail} />
			<circle cx="6" cy="6" r="0.9" fill="#131628" />
		</svg>
	);
}

interface HarborCatProps {
	pose?: 'standing' | 'lying';  // 'lying' is the mock's draped-along-an-edge variant
}

export function HarborCat({ pose = 'standing' }: HarborCatProps) {
	if (pose === 'lying') {
		return (
			<svg width="55" height="26" viewBox="0 0 100 48" fill="none" style={{ overflow: 'visible' }}>
				<path d="M72 38 C85 33 91 41 86 46.5 C84 49 80.2 48.4 80.8 45.2 C83 41.4 78.6 39.6 72.6 42.4 Z"
					fill="#232a4d" stroke="#93a0e8" strokeWidth="1.4" strokeLinejoin="round"
					style={{ transformOrigin: '73px 40px', animation: 'tailDrape 5s ease-in-out infinite' }} />
				<ellipse cx="10.5" cy="42.6" rx="4.6" ry="2.7" fill="#232a4d" stroke="#93a0e8" strokeWidth="1.3" />
				<ellipse cx="18.5" cy="42.9" rx="4.4" ry="2.6" fill="#232a4d" stroke="#93a0e8" strokeWidth="1.3" />
				<path d="M13.5 44 C8.5 39 9 30 13 25 L12.8 22 L12.4 10 L18.6 17 L24.5 17 L30 10 L30.5 22 C35.5 25 38.5 27 44.5 28.5 C56 25.5 69 26.5 77.5 32.5 C83.5 36.8 83 42 76 44 Z"
					fill="#232a4d" stroke="#93a0e8" strokeWidth="1.6" strokeLinejoin="round" />
				<ellipse cx="68" cy="43.2" rx="5" ry="2.4" fill="#232a4d" stroke="#93a0e8" strokeWidth="1.2" />
				<path d="M13.7 16 L13.5 11.5 L17 15 Z" fill="#f0d9a8" opacity=".5" />
				<path d="M29 16 L29.4 11.5 L26 15 Z" fill="#f0d9a8" opacity=".5" />
				<g style={{ transformOrigin: '22px 27px', animation: 'blink 6s ease-in-out infinite' }}>
					<circle cx="17.8" cy="26.8" r="1.9" fill="#f0d9a8" />
					<circle cx="26" cy="26.8" r="1.9" fill="#f0d9a8" />
				</g>
				<path d="M20.6 30.4 L23.4 30.4 L22 32 Z" fill="#f0d9a8" />
				<path d="M22 32 v1.3 M22 33.3 q-2 1.4 -3.6 .4 M22 33.3 q2 1.4 3.6 .4" stroke="#5f6ec4" strokeWidth="1" fill="none" strokeLinecap="round" />
				<path d="M12.6 29 l-7 -1.3 M12.6 31.2 l-7 .9 M30.5 29 l7 -1.3 M30.5 31.2 l7 .9" stroke="#5f6ec4" strokeWidth="0.9" strokeLinecap="round" opacity=".7" />
				<path d="M15.8 36 q3 1.6 6.4 .6" stroke="#5f6ec4" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity=".45" />
			</svg>
		);
	}
	return (
		<svg width="36" height="30" viewBox="0 0 34 30" fill="none">
			<path d="M26 28 C31.5 27 32.5 22 29.5 19.5" stroke="#93a0e8" strokeWidth="1.4" fill="none" strokeLinecap="round"
				style={{ transformOrigin: '26px 28px', animation: 'tailSwish 4s ease-in-out infinite' }} />
			<path d="M7 28 C5 22 7.5 16 12 14 L11.5 8.5 L14.8 11.8 L18.2 11.8 L21.5 8.5 L21 14 C25.5 16 28 22 26 28 Z"
				fill="#232a4d" stroke="#93a0e8" strokeWidth="1.4" strokeLinejoin="round" />
			<circle cx="14" cy="16.5" r="1" fill="#f0d9a8" />
			<circle cx="19" cy="16.5" r="1" fill="#f0d9a8" />
		</svg>
	);
}

interface DriftDotProps {
	color:    'gold' | 'peri';
	size?:    number;
	duration: string;
	delay?:   string;
	style:    CSSProperties;
}

/** One of the drifting harbor lights that float over every screen. */
export function DriftDot({ color, size = 4, duration, delay = '0s', style }: DriftDotProps) {
	const hex = color === 'gold' ? '#f0d9a8' : '#93a0e8';
	const glow = color === 'gold' ? 'rgba(240,217,168,.35)' : 'rgba(147,160,232,.3)';
	return (
		<div className="drift-dot" style={{
			width: size, height: size, background: hex,
			boxShadow: `0 0 12px 3px ${glow}`,
			animation: `drift ${duration} ease-in-out ${delay} infinite`,
			...style,
		}} />
	);
}
