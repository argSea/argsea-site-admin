// The chart's geometry, shared by the fleet office's drag surface. The window
// and the projection are transcribed verbatim from the public chart island
// (argsea-site src/components/islands/ShipsLog.tsx): a bearing dropped here must
// land exactly where the public site would draw it, so proj/unproj are an exact
// inverse pair over the same window. Nothing else here fetches; this is pure
// geometry the screen leans on to stay thin.
import type { Coord, HobbyState } from './api';

// The public chart's projection window: the lat/lon the frame's four edges map
// to. Do not drift these from the island, or a pinned bearing renders off its
// mark on the live site.
export const CHART_WIN = { latTop: 58.58, latBot: 57.80, lonLeft: -7.98, lonRight: -6.55 };

// The Flannan Isle memorial's light, the fixed reference moored hobbies cluster
// around. Transcribed from the island's MEMORIAL_COORD.
export const MEMORIAL_COORD: Coord = { lat: 58.283, lon: -7.583 };

// The band the API and the editor's snapCoord hold on the wire: the window
// inset ~3% per side, so a pinned mark sits fully inside the frame. A dropped
// bearing clamps into this on the way to the pin (the API clamps again anyway).
export const BAND_LAT = [57.82, 58.56] as const;
export const BAND_LON = [-7.94, -6.59] as const;

// A rendered position inside the chart window, in percent of the frame.
export interface XY {
	x: number;
	y: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// A bearing to its rendered position, verbatim from the island's proj().
export function proj(c: Coord): XY {
	const w = CHART_WIN;
	return {
		x: ((c.lon - w.lonLeft) / (w.lonRight - w.lonLeft)) * 100,
		y: ((w.latTop - c.lat) / (w.latTop - w.latBot)) * 100,
	};
}

// The exact inverse of proj: a rendered position back to the bearing that
// projects there. proj(unproj(p)) === p and unproj(proj(c)) === c, so a drop at
// a mark's on-screen spot round-trips to the coordinate the public chart plots
// there. This is the fidelity-critical half of the drag surface.
export function unproj(p: XY): Coord {
	const w = CHART_WIN;
	return {
		lon: w.lonLeft + (p.x / 100) * (w.lonRight - w.lonLeft),
		lat: w.latTop - (p.y / 100) * (w.latTop - w.latBot),
	};
}

// Clamp a bearing into the wire band. Applied on the way to a pin so the keeper
// never saves a coordinate the API would just clamp out from under them.
export function snapToBand(c: Coord): Coord {
	return {
		lat: clamp(c.lat, BAND_LAT[0], BAND_LAT[1]),
		lon: clamp(c.lon, BAND_LON[0], BAND_LON[1]),
	};
}

// The wake's curved path and its origin dot, verbatim from the island's
// wakePath(): a shallow bow off the straight run from where a hobby slipped its
// mooring (a) to where it went quiet (b). Both endpoints are percents.
export function wakePath(a: Coord, b: Coord): { d: string; ox: number; oy: number } {
	const p1 = proj(a), p2 = proj(b);
	const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
	const dx = p2.x - p1.x, dy = p2.y - p1.y;
	const len = Math.hypot(dx, dy) || 1;
	const bow = Math.min(10, len * 0.3);
	const cx = mx + (-dy / len) * bow, cy = my + (dx / len) * bow;
	return {
		d: `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`,
		ox: p1.x,
		oy: p1.y,
	};
}

// The state tints, echoing the island's STATE_META solids (simplified to the
// flat hex the mark and its name pill paint from). Moored reads gold, the
// off-fairway states cool.
export const STATE_COLOR: Record<HobbyState, string> = {
	moored:   '#f0d9a8',
	port:     '#6fca97',
	adrift:   '#93a0e8',
	marooned: '#93a0e8',
	inkspill: '#8a93c4',
};

// A tight scatter radius (degrees) off the memorial for the moored cluster, and
// the modest drift a re-scattered wake's origin sits back from its new mark.
const MOORED_RADIUS = 0.05;
const DRIFT = 0.06;

function uniformInBand(rng: () => number): Coord {
	return snapToBand({
		lat: BAND_LAT[0] + rng() * (BAND_LAT[1] - BAND_LAT[0]),
		lon: BAND_LON[0] + rng() * (BAND_LON[1] - BAND_LON[0]),
	});
}

function nearMemorial(rng: () => number): Coord {
	const angle = rng() * 2 * Math.PI;
	const radius = MOORED_RADIUS * Math.sqrt(rng());
	return snapToBand({
		lat: MEMORIAL_COORD.lat + radius * Math.sin(angle),
		lon: MEMORIAL_COORD.lon + radius * Math.cos(angle),
	});
}

// A fresh scatter for one hobby: moored ships land in a tight cluster off Eilean
// Mòr, every other state (uncharted hobbies pulled from the tray included) lands
// uniformly across the band. The wake follows the public site's own logic, which
// draws a wake for any hobby that carries a `from`: keep that wake-ness, so a
// hobby that has an origin gets a fresh one a modest drift back from its new
// mark, and one the site draws no wake for keeps `from` as the model has it.
export function scatterBearing(state: HobbyState, hasWake: boolean, rng: () => number = Math.random): { coord: Coord; from: Coord | null } {
	const coord = 'moored' === state ? nearMemorial(rng) : uniformInBand(rng);
	if (!hasWake) {
		return { coord, from: null };
	}
	const from = snapToBand({
		lat: coord.lat + (rng() * 2 - 1) * DRIFT,
		lon: coord.lon + (rng() * 2 - 1) * DRIFT,
	});
	return { coord, from };
}
