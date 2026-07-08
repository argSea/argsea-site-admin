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

export function HarborCat() {
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
