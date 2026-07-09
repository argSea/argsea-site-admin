// The engine-driven lamp: halo + core, ignited by lightChar's real burn. One
// component backs the rack's mini lamp, the edit preview, and the coast pin,
// so all three ever only read one signature.
import { useEffect, useRef } from 'react';
import type { Light } from '../lib/api';
import { GLOW_RGB, ignite } from '../lib/lightChar';

interface Props {
	light:      Light;
	size?:      number;  // core diameter, px
	haloScale?: number;  // halo diameter, multiples of size
	peak?:      number;  // resting opacity while lit
}

export default function Lamp({ light, size = 14, haloScale = 3, peak = 1 }: Props) {
	const haloRef = useRef<HTMLDivElement>(null);
	const coreRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		// extinguished is the caller's own static dim styling below; the engine
		// never runs on a dead light
		if (light.extinguished) {
			return;
		}
		const haloAnim = haloRef.current ? ignite(haloRef.current, light, peak * 0.6) : null;
		const coreAnim = coreRef.current ? ignite(coreRef.current, light, peak) : null;
		return () => {
			haloAnim?.cancel();
			coreAnim?.cancel();
		};
	}, [light, peak]);

	const rgb = light.extinguished ? GLOW_RGB.dark : GLOW_RGB[light.color];
	const halo = size * haloScale;
	const dim = light.extinguished ? 0.35 : undefined;

	return (
		<div style={{ position: 'relative', width: halo, height: halo, flexShrink: 0 }}>
			<div ref={haloRef} style={{
				position: 'absolute', left: '50%', top: '50%', width: halo, height: halo,
				transform: 'translate(-50%,-50%)', borderRadius: '50%', pointerEvents: 'none',
				background: `radial-gradient(circle, rgba(${rgb},.55) 0%, transparent 68%)`, filter: 'blur(2px)',
				opacity: dim,
			}} />
			<div ref={coreRef} style={{
				position: 'absolute', left: '50%', top: '50%', width: size, height: size,
				transform: 'translate(-50%,-50%)', borderRadius: '50%', pointerEvents: 'none',
				background: `rgb(${rgb})`, boxShadow: `0 0 ${Math.round(size * 1.1)}px ${Math.round(size * 0.3)}px rgba(${rgb},.75)`,
				opacity: dim,
			}} />
		</div>
	);
}
