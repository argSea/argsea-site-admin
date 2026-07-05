// Stamp-designer vocabulary and the surprise-me generator, verbatim from the
// design. The enums here are the API's closed vocabulary — the designer only
// ever produces valid stamps, so {} never reaches the wire.

import type { Stamp, StampInk, StampMotif } from './api';

export const MOTIF_IDS: readonly Exclude<StampMotif, 'text'>[] =
	['lighthouse', 'boat', 'sun', 'wave', 'moon', 'anchor'];

export const INKS: readonly StampInk[] = ['#f0d9a8', '#93a0e8'];

export const CENTS_OPTIONS = ['1¢', '2¢', '3¢', '5¢', '8¢', '12¢'];

export const POSTMARK_TEXTS = ['DAILY SINCE 1786', 'AIR MAIL', 'PAR AVION', 'FIRST CLASS', 'VIA HARBOR', 'SHIPPED IT'];

export const STAMP_TEXT_MAX = 40;

export const DEFAULT_STAMP: Stamp = { shape: 'rect', motif: 'lighthouse', ink: '#f0d9a8', cents: '3¢' };

export function randomStamp(): Stamp {
	const pick = <T>(options: readonly T[]): T => options[Math.floor(Math.random() * options.length)];
	const ink = pick(INKS);

	if (Math.random() < 0.35) {
		return { shape: 'circle', motif: Math.random() < 0.5 ? 'text' : pick(MOTIF_IDS), ink, text: pick(POSTMARK_TEXTS) };
	}
	return { shape: 'rect', motif: pick(MOTIF_IDS), ink, cents: pick(CENTS_OPTIONS) };
}

/**
 * Shape a designer stamp for the wire: cents ride on rect only, text on the
 * text motif only (trimmed, capped at 40), and a text motif without words is
 * invalid — callers block the save instead of sending it.
 */
export function stampForWire(stamp: Stamp): Stamp {
	const wire: Stamp = { shape: stamp.shape, motif: stamp.motif, ink: stamp.ink };
	if (stamp.shape === 'rect' && stamp.cents) {
		wire.cents = stamp.cents;
	}
	if (stamp.motif === 'text') {
		wire.text = (stamp.text ?? '').trim().slice(0, STAMP_TEXT_MAX);
	}
	return wire;
}
