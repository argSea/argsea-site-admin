// The chart's geometry, shared by the office's drag surfaces. The window, the
// Mercator projection and the coastline are transcribed from the public Helm
// island (argsea-site src/components/islands/Helm.tsx): a berth dropped here
// must land exactly where the public site would draw it, so proj/unproj are an
// exact inverse pair over the same window. Nothing else here fetches; this is
// pure geometry the screens lean on to stay thin.
//
// One deliberate divergence from the island as built: SOUTH is the ratified
// 57.80, not the island's 57.95. The banked canon carries the southward push
// and the built island still lags it (contract: the chart-berths wire document,
// Amendment 2); a site slice owes that translation. Everything else here is the
// island's own arithmetic, and when the island catches up this constant is the
// only line that has to agree.
import type { Coord, HobbyState } from './api';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// Mercator: a straight line on the paper is a constant compass course.
const mercY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * D2R) / 2)) * R2D;

export const WEST = -8.30, EAST = -6.10, SOUTH = 57.80, NORTH = 58.70;

// The island's pixels-per-degree, kept so the transcribed coastline and islet
// radii read at the scale they were drawn for.
const PPD = 710;

// The chart's own drawing space, in the island's pixels. The frame is held at
// this aspect wherever it renders: squash it and a mark sits off its bearing.
export const CHART_W = Math.round((EAST - WEST) * PPD);
export const CHART_H = Math.round((mercY(NORTH) - mercY(SOUTH)) * PPD);

// The Flannan Isle memorial's light, the fixed reference moored hobbies cluster
// around. Transcribed from the island's Eilean Mòr islet.
export const MEMORIAL_COORD: Coord = { lat: 58.2882, lon: -7.5872 };

// The band a dropped berth clamps into on the way to a pin: the Helm's extent
// itself, since the office's job is to show what the public chart will show.
// The wire takes any earth-range coordinate (contract: chart windows are
// presentation), so this band is the office being helpful, not the law.
export const BAND_LAT = [SOUTH, NORTH] as const;
export const BAND_LON = [WEST, EAST] as const;

// A rendered position inside the chart window, in percent of the frame.
export interface XY {
	x: number;
	y: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

// A bearing to its rendered position, the island's x()/y() normalized to
// percent so a mark can be positioned in CSS without knowing the pixel frame.
export function proj(c: Coord): XY {
	return {
		x: ((c.lon - WEST) / (EAST - WEST)) * 100,
		y: ((mercY(NORTH) - mercY(c.lat)) / (mercY(NORTH) - mercY(SOUTH))) * 100,
	};
}

// The exact inverse of proj: a rendered position back to the bearing that
// projects there. proj(unproj(p)) === p and unproj(proj(c)) === c, so a drop at
// a mark's on-screen spot round-trips to the coordinate the public chart plots
// there. This is the fidelity-critical half of the drag surface.
export function unproj(p: XY): Coord {
	const m = mercY(NORTH) - (p.y / 100) * (mercY(NORTH) - mercY(SOUTH));
	return {
		lon: WEST + (p.x / 100) * (EAST - WEST),
		lat: (2 * Math.atan(Math.exp(m * D2R)) - Math.PI / 2) * R2D,
	};
}

// The same projection in the drawing space the SVG furniture is ruled in, so
// the coastline and the wakes share one coordinate system with the marks.
export function projPx(c: Coord): XY {
	const p = proj(c);
	return { x: (p.x / 100) * CHART_W, y: (p.y / 100) * CHART_H };
}

// Clamp a bearing into the band. Applied on the way to a pin so the keeper
// never saves a berth outside the frame they placed it in.
export function snapToBand(c: Coord): Coord {
	return {
		lat: clamp(c.lat, BAND_LAT[0], BAND_LAT[1]),
		lon: clamp(c.lon, BAND_LON[0], BAND_LON[1]),
	};
}

// The Lewis coastline and the Flannan islets, transcribed from the island. The
// coast runs as a closed fill down the chart's eastern edge; the islets are the
// small cluster the memorial sits in.
export const LEWIS: Coord[] = [
	{ lon: -6.10, lat: 58.70 }, { lon: -6.26, lat: 58.515 }, { lon: -6.45, lat: 58.42 },
	{ lon: -6.53, lat: 58.36 }, { lon: -6.70, lat: 58.31 }, { lon: -6.79, lat: 58.28 },
	{ lon: -6.85, lat: 58.22 }, { lon: -6.95, lat: 58.21 }, { lon: -7.02, lat: 58.20 },
	{ lon: -7.05, lat: 58.235 }, { lon: -7.06, lat: 58.16 }, { lon: -7.10, lat: 58.11 },
	{ lon: -7.05, lat: 58.02 }, { lon: -6.90, lat: 57.95 }, { lon: -6.10, lat: 57.95 },
];

export const ISLETS: { name: string; lat: number; lon: number; r: number }[] = [
	{ name: 'Eilean Mòr', lat: 58.2882, lon: -7.5872, r: 5 },
	{ name: 'Eilean Tighe', lat: 58.2855, lon: -7.5820, r: 3 },
	{ name: 'Soray', lat: 58.2930, lon: -7.6060, r: 3 },
	{ name: 'Sgeir Toman', lat: 58.2960, lon: -7.6120, r: 2 },
	{ name: "Eilean a' Ghobha", lat: 58.2900, lon: -7.6250, r: 3 },
	{ name: 'Roareim', lat: 58.2990, lon: -7.6380, r: 3 },
	{ name: 'Bròna Cleit', lat: 58.2760, lon: -7.6560, r: 2 },
];

// The path the coastline fill draws, closed along the chart's south-east corner
// so the land reads as land rather than as a stray line.
export function coastPath(): string {
	const pts = LEWIS.map((c) => projPx(c)).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
	return `M${pts.join(' L')} L${CHART_W} ${CHART_H} L${pts[0].split(' ')[0]} ${CHART_H} Z`;
}

// The wake's curved path, verbatim from the island's own bow: a shallow arc off
// the straight run from where a hobby slipped its mooring (a) to where it went
// quiet (b). Drawn in the chart's pixel space, like the coastline.
export function wakePath(a: Coord, b: Coord): string {
	const p1 = projPx(a), p2 = projPx(b);
	const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
	const dx = p2.x - p1.x, dy = p2.y - p1.y;
	const len = Math.hypot(dx, dy) || 1;
	const bow = Math.min(0.1 * CHART_W, len * 0.3);
	const cx = mx + (-dy / len) * bow, cy = my + (dx / len) * bow;
	return `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
}

// The state tints, echoing the island's own solids (simplified to the flat hex
// the mark and its name pill paint from). Moored reads gold, the off-fairway
// states cool.
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
