// The light's navigational characteristic: kind/color/period/letter turned
// into the mono code, the plain-language words, and the real burn (a Web
// Animations timeline, not a CSS keyframe loop) that the rack, the edit
// preview, and the coast all ignite off the same element. Hand-mirrored from
// the site's own module (contract note in api.ts): keep this file in
// lockstep with it.
import type { Light, LightColor } from './api';

export const DEFAULT_LIGHT: Light = { kind: 'fixed', color: 'white', period: 0, letter: '', extinguished: '' };

// The glow a lit lamp radiates, by color; 'dark' is the dead-ash tint for an
// extinguished light (the caller's static styling, not this module's).
export const GLOW_RGB: Record<LightColor | 'dark', string> = {
	white: '246,236,207',
	red:   '231,122,112',
	green: '111,202,151',
	dark:  '120,132,170',
};

// Kinds whose rhythm the keeper dials in with the period slider. Fixed holds
// steady, and quick/veryquick blink at a rate set by convention, so neither
// shows the slider nor stores anything in period.
export const RHYTHM_KINDS: Light['kind'][] = ['flash', 'occult', 'iso', 'morse'];

// The morse letter picker's options; also doubles as "let the sea decide"'s draw.
export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const COLOR_LETTER: Record<LightColor, string> = { white: 'W', red: 'R', green: 'G' };
const ABBR: Record<'flash' | 'occult' | 'iso', string> = { flash: 'Fl', occult: 'Oc', iso: 'Iso' };

/** The mono signature, e.g. "F W", "Fl G 6s", or "Mo(A) W 8s": how a stranger tells this light from the others. */
export function codeFor(light: Light): string {
	const letter = COLOR_LETTER[light.color];
	switch (light.kind) {
		case 'fixed':     return `F ${letter}`;
		case 'quick':     return `Q ${letter}`;
		case 'veryquick': return `VQ ${letter}`;
		case 'morse':     return `Mo(${light.letter}) ${letter} ${light.period}s`;
		default:          return `${ABBR[light.kind]} ${letter} ${light.period}s`;
	}
}

function burning(light: Light): string {
	switch (light.kind) {
		case 'fixed':     return `fixed ${light.color}, a steady light that never blinks`;
		case 'flash':     return `flashing ${light.color}, dark with a bright flash every ${light.period} seconds`;
		case 'occult':    return `occulting ${light.color}, steady with a brief eclipse every ${light.period} seconds`;
		case 'iso':       return `isophase ${light.color}, equal parts light and dark every ${light.period} seconds`;
		case 'quick':     return `quick ${light.color}, a fast pulse about once a second`;
		case 'veryquick': return `very quick ${light.color}, an urgent pulse twice a second`;
		case 'morse':     return `morse ${light.color}, blinking ${light.letter} every ${light.period} seconds`;
	}
}

/** The plain-language description; an extinguished light describes what it used to be. */
export function wordsFor(light: Light): string {
	const words = burning(light);
	return light.extinguished ? `formerly ${words}, extinguished ${light.extinguished}` : words;
}

// International morse, A-Z only (the letter picker's whole range).
const MORSE: Record<string, string> = {
	A: '.-',   B: '-...', C: '-.-.', D: '-..',  E: '.',    F: '..-.', G: '--.',
	H: '....', I: '..',   J: '.---', K: '-.-',  L: '.-..', M: '--',   N: '-.',
	O: '---',  P: '.--.', Q: '--.-', R: '.-.',  S: '...',  T: '-',    U: '..-',
	V: '...-', W: '.--',  X: '-..-', Y: '-.--', Z: '--..',
};

const MORSE_UNIT = 0.4; // seconds per dot or gap; a dash holds three units

// Turns a letter's dots and dashes into lit spans, one morse unit at a time,
// a unit of dark between each element. Whatever period is left over past the
// pattern just stays dark: morse doesn't loop the letter, it rests.
function morseSpans(letter: string): [number, number][] {
	const pattern = MORSE[letter] ?? '';
	const spans: [number, number][] = [];
	let t = 0;
	for (let i = 0; i < pattern.length; i++) {
		const len = pattern[i] === '-' ? MORSE_UNIT * 3 : MORSE_UNIT;
		spans.push([t, t + len]);
		t += len;
		if (i < pattern.length - 1) {
			t += MORSE_UNIT;
		}
	}
	return spans;
}

export interface Timeline {
	period: number;
	spans:  [number, number][];
}

// A kind's lit spans within one cycle, plus the cycle length itself: most
// kinds animate on the stored period, but quick/veryquick blink at a rate
// fixed by convention (unrendered by design, so nothing is stored for it) and
// morse spells its letter, however long that runs. Fixed carries no spans:
// it just burns, and its period is never read.
export function timeline(light: Light): Timeline {
	switch (light.kind) {
		case 'fixed':     return { period: light.period, spans: [] };
		case 'flash':     return { period: light.period, spans: [[0, 0.8]] };
		case 'occult':    return { period: light.period, spans: [[0, 0.6], [1.7, light.period]] };
		case 'iso':       return { period: light.period, spans: [[0, light.period / 2]] };
		case 'quick':     return { period: 1.0, spans: [[0, 0.3]] };
		case 'veryquick': return { period: 0.5, spans: [[0, 0.15]] };
		case 'morse':     return { period: light.period, spans: morseSpans(light.letter) };
	}
}

const EDGE = 0.07; // ramp-to-peak time at each span boundary, seconds

// Turns lit spans into a monotonic opacity keyframe list, offsets normalized
// to the period. Each span gets a quick ramp up, a hold at peak, and a quick
// ramp down, so the light doesn't just snap on and off.
function keyframesFor(light: Light, peak: number): Keyframe[] {
	const { period, spans } = timeline(light);
	const clamp = (t: number) => Math.max(0, Math.min(period, t));
	const points: { t: number; opacity: number }[] = [{ t: 0, opacity: 0 }];

	spans.forEach(([start, end]) => {
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
 * lockstep instead of drifting from whenever each one happened to mount. The
 * animation runs on the timeline's own cycle length, not light.period
 * directly: quick/veryquick's rhythm is fixed by convention, not stored.
 */
export function ignite(el: HTMLElement, light: Light, peak: number): Animation | null {
	el.getAnimations().forEach((animation) => animation.cancel());

	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (light.kind === 'fixed' || reduced) {
		el.style.opacity = String(peak);
		return null;
	}

	el.style.opacity = '';
	const animation = el.animate(keyframesFor(light, peak), { duration: timeline(light).period * 1000, iterations: Infinity });
	animation.startTime = 0;
	return animation;
}

const KINDS: Light['kind'][] = ['fixed', 'flash', 'occult', 'iso', 'quick', 'veryquick', 'morse'];
// weighted toward white, same as the design's own "let the sea decide" deck
const COLORS: LightColor[] = ['white', 'white', 'white', 'red', 'green'];

/** Let the sea decide: a random kind/color/period/letter. Extinguished rides along untouched. */
export function randomLight(current: Light): Light {
	const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
	const color = COLORS[Math.floor(Math.random() * COLORS.length)];
	const period = !RHYTHM_KINDS.includes(kind)
		? 0
		: kind === 'morse'
			? 4 + Math.floor(Math.random() * 27)
			: 2 + Math.floor(Math.random() * 11);
	const letter = kind === 'morse' ? LETTERS[Math.floor(Math.random() * LETTERS.length)] : '';
	return { ...current, kind, color, period, letter };
}
