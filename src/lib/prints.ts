// Print (media) display helpers. Real prints render their file; a reference
// whose print has gone missing falls back to one of the design's harbor
// gradients, picked stably by name so it doesn't shimmer between renders.

import type { MediaItem } from './api';
import { mediaUrl } from './api';

export const GRADIENTS = [
	'linear-gradient(135deg,#2a3054,#5f6ec4)',
	'linear-gradient(135deg,#1f2440,#93a0e8)',
	'linear-gradient(135deg,#3a3350,#f0d9a8)',
	'linear-gradient(135deg,#232a4d,#7a83ad)',
	'linear-gradient(135deg,#1a1e33,#5f6ec4)',
	'linear-gradient(135deg,#2d2a45,#c3cbf2)',
];

function tone(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = (hash * 31 + name.charCodeAt(i)) | 0;
	}
	return Math.abs(hash) % GRADIENTS.length;
}

/** CSS background for a media reference: the print itself, or its gradient. */
export function printBackground(prints: MediaItem[], filename: string): string {
	const print = prints.find((p) => p.filename === filename);
	return print ? `url("${mediaUrl(print.url)}") center/cover` : GRADIENTS[tone(filename)];
}
