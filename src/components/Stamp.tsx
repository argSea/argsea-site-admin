// Postcard stamp/postmark renderer, value-for-value from the design's
// renderStamp (and the site's twin island). Rect stamps: solid border, motif
// or words, optional cents in the corner. Circle postmarks: dashed border.
// Absent stamps fall back to the design default.
import { Fragment } from 'react';
import type { Stamp as StampData, StampMotif } from '../lib/api';
import { DEFAULT_STAMP } from '../lib/stamp';

const MONO = "'IBM Plex Mono', monospace";

interface MotifProps {
	motif: Exclude<StampMotif, 'text'>;
	ink:   string;
	size:  number;
}

function MotifSvg({ motif, ink, size }: MotifProps) {
	// The two inks pair up: whichever isn't the stamp's ink is the accent
	const alt = ink === '#f0d9a8' ? '#93a0e8' : '#f0d9a8';
	const stroked = { stroke: ink, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round' as const };

	switch (motif) {
		case 'lighthouse':
			return (
				<svg width={size} height={size * 1.15} viewBox="0 0 26 30" fill="none">
					<path d="M13 4 L17 11 L9 11 Z" fill={ink} />
					<rect x="10" y="11" width="6" height="12" stroke={alt} strokeWidth={1.6} fill="none" />
					<path d="M7 26 q6 -3 12 0" stroke="#5f6ec4" strokeWidth={1.6} fill="none" strokeLinecap="round" />
				</svg>
			);
		case 'boat':
			return (
				<svg width={size} height={size} viewBox="0 0 30 24" fill="none">
					<path d="M4 15 L26 15 L21 22 L9 22 Z" fill={alt} />
					<path d="M15 15 V3" stroke="#5f6ec4" strokeWidth={1.5} fill="none" strokeLinecap="round" />
					<path d="M15 3 L24 13 L15 13 Z" fill={ink} />
				</svg>
			);
		case 'sun':
			return (
				<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
					<circle cx="12" cy="12" r="4.5" stroke={ink} strokeWidth={1.6} />
					<path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6L17.3 6.7M6.7 17.3l-2.1 2.1" {...stroked} />
				</svg>
			);
		case 'wave':
			return (
				<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
					<path d="M2 9q2.5-4 5 0t5 0t5 0t5 0" {...stroked} />
					<path d="M2 15q2.5-4 5 0t5 0t5 0t5 0" {...stroked} />
				</svg>
			);
		case 'moon':
			return (
				<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
					<path d="M15.5 3a9 9 0 1 0 5.5 15.5A8 8 0 0 1 15.5 3" stroke={ink} strokeWidth={1.6} fill="none" strokeLinejoin="round" />
					<circle cx="18" cy="7" r="1" fill={alt} />
				</svg>
			);
		case 'anchor':
			return (
				<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
					<circle cx="12" cy="5" r="2.2" stroke={ink} strokeWidth={1.6} />
					<path d="M12 7.2V19M8.5 10.5h7M4.5 13.5a7.5 7.5 0 0 0 15 0M4.5 13.5l-1.6 1.8M4.5 13.5l2.2 1M19.5 13.5l1.6 1.8M19.5 13.5l-2.2 1" {...stroked} />
				</svg>
			);
	}
}

interface Props {
	stamp?: StampData | null;
	scale?: number;
}

export default function Stamp({ stamp, scale = 1 }: Props) {
	const st = stamp ?? DEFAULT_STAMP;

	const content = st.motif === 'text'
		? (
			<div style={{ fontFamily: MONO, fontSize: 7.5 * scale, letterSpacing: '.1em', color: st.ink, textAlign: 'center', lineHeight: 1.6, textTransform: 'uppercase', overflow: 'hidden' }}>
				{(st.text || 'AIR MAIL').trim().split(/\s+/).map((word, index) => (
					<Fragment key={index}>{index > 0 && <br />}{word}</Fragment>
				))}
			</div>
		)
		: <MotifSvg motif={st.motif} ink={st.ink} size={18 * scale} />;

	if (st.shape === 'circle') {
		return (
			<div style={{ width: 52 * scale, height: 52 * scale, boxSizing: 'border-box', border: `1.2px dashed ${st.ink}73`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'wiggle 7s ease-in-out infinite', flexShrink: 0 }}>
				{content}
			</div>
		);
	}

	return (
		<div style={{ width: 34 * scale, height: 42 * scale, boxSizing: 'border-box', border: `1.5px solid ${st.ink}80`, borderRadius: 3, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'wiggle 6s ease-in-out infinite', flexShrink: 0 }}>
			{content}
			{st.cents && (
				<span style={{ position: 'absolute', top: 1.5 * scale, right: 2.5 * scale, fontFamily: MONO, fontSize: 6.5 * scale, color: st.ink }}>{st.cents}</span>
			)}
		</div>
	);
}
