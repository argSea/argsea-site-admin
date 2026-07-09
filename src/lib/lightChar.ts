// The light's navigational characteristic: kind/color/period turned into the
// mono code, the plain-language words, and the real burn (a Web Animations
// timeline, not a CSS keyframe loop) that the rack, the edit preview, and the
// coast all ignite off the same element. Hand-mirrored from the site's own
// module (contract note in api.ts): keep this file in lockstep with it.
import type { Light, LightColor } from './api';

export const DEFAULT_LIGHT: Light = { kind: 'fixed', color: 'white', period: 0, extinguished: '' };

// The glow a lit lamp radiates, by color; 'dark' is the dead-ash tint for an
// extinguished light (the caller's static styling, not this module's).
export const GLOW_RGB: Record<LightColor | 'dark', string> = {
	white: '246,236,207',
	red:   '231,122,112',
	green: '111,202,151',
	dark:  '120,132,170',
};

const LETTER: Record<LightColor, string> = { white: 'W', red: 'R', green: 'G' };
const ABBR: Record<Exclude<Light['kind'], 'fixed'>, string> = { flash: 'Fl', occult: 'Oc', iso: 'Iso' };

/** The mono signature, e.g. "F W" or "Fl G 6s": how a stranger tells this light from the others. */
export function codeFor(light: Light): string {
	const letter = LETTER[light.color];
	return light.kind === 'fixed' ? `F ${letter}` : `${ABBR[light.kind]} ${letter} ${light.period}s`;
}

function burning(light: Light): string {
	switch (light.kind) {
		case 'fixed':  return `fixed ${light.color}, a steady light that never blinks`;
		case 'flash':  return `flashing ${light.color}, dark with a bright flash every ${light.period} seconds`;
		case 'occult': return `occulting ${light.color}, steady with a brief eclipse every ${light.period} seconds`;
		case 'iso':    return `isophase ${light.color}, equal parts light and dark every ${light.period} seconds`;
	}
}

/** The plain-language description; an extinguished light describes what it used to be. */
export function wordsFor(light: Light): string {
	const words = burning(light);
	return light.extinguished ? `formerly ${words}, extinguished ${light.extinguished}` : words;
}

// Seconds-into-period spans the light is lit, for the blinking kinds. Fixed
// has none: it just burns. Numbers are the maritime characteristic itself,
// not scaled to the period (a real occulting light's eclipse is a fixed
// stretch, however long the cycle around it runs).
export function timeline(light: Light): [number, number][] {
	switch (light.kind) {
		case 'flash':  return [[0, 0.8]];
		case 'occult': return [[0, 0.6], [1.7, light.period]];
		case 'iso':    return [[0, light.period / 2]];
		case 'fixed':  return [];
	}
}

const EDGE = 0.07; // ramp-to-peak time at each span boundary, seconds

// Turns lit spans into a monotonic opacity keyframe list, offsets normalized
// to the period. Each span gets a quick ramp up, a hold at peak, and a quick
// ramp down, so the light doesn't just snap on and off.
function keyframesFor(light: Light, peak: number): Keyframe[] {
	const period = light.period;
	const clamp = (t: number) => Math.max(0, Math.min(period, t));
	const points: { t: number; opacity: number }[] = [{ t: 0, opacity: 0 }];

	timeline(light).forEach(([start, end]) => {
		points.push({ t: clamp(start - EDGE), opacity: 0 });
		points.push({ t: clamp(start), opacity: peak });
		points.push({ t: clamp(end), opacity: peak });
		points.push({ t: clamp(end + EDGE), opacity: 0 });
	});

	points.push({ t: period, opacity: 0 });

	return points.map(({ t, opacity }) => ({ offset: t / period, opacity }));
}

/**
 * Ignites an element with the light's real burn. Fixed and reduced-motion
 * both resolve to a static peak; an extinguished light is the caller's own
 * static dim styling, so it's never passed here. `startTime = 0` phase-locks
 * every lamp to the same clock, so two lights sharing a rhythm blink in
 * lockstep instead of drifting from whenever each one happened to mount.
 */
export function ignite(el: HTMLElement, light: Light, peak: number): Animation | null {
	el.getAnimations().forEach((animation) => animation.cancel());

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (light.kind === 'fixed' || reduced) {
		el.style.opacity = String(peak);
		return null;
	}

	el.style.opacity = '';
	const animation = el.animate(keyframesFor(light, peak), { duration: light.period * 1000, iterations: Infinity });
	animation.startTime = 0;
	return animation;
}

const KINDS: Light['kind'][] = ['fixed', 'flash', 'occult', 'iso'];
// weighted toward white, same as the design's own "let the sea decide" deck
const COLORS: LightColor[] = ['white', 'white', 'white', 'red', 'green'];

/** Let the sea decide: a random kind/color/period. Extinguished rides along untouched. */
export function randomLight(current: Light): Light {
	const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
	const color = COLORS[Math.floor(Math.random() * COLORS.length)];
	const period = kind === 'fixed' ? 0 : 2 + Math.floor(Math.random() * 11);
	return { ...current, kind, color, period };
}
