// Geometry for the figurehead shop. The contract's Shape stays the only shape
// model; this module parses path data into an editable anchor/handle form,
// serializes it back, bakes transforms into coordinates (shapes carry no
// transform field, by contract), and smooths freehand strokes into beziers.
import type { Linecap, Linejoin, Shape } from './api';

export interface Pt {
	x: number;
	y: number;
}

// An anchor with optional absolute handle points. The segment from anchor a to
// anchor b is the cubic (a, a.out ?? a, b.in ?? b, b): a straight line when
// both handles are absent.
export interface Anchor {
	x:    number;
	y:    number;
	in?:  Pt;
	out?: Pt;
}

export interface SubPath {
	closed:  boolean;
	anchors: Anchor[];
}

export interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Round to 2 decimals, keeps stored documents tidy without visible loss. */
export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

export function parseViewBox(viewBox: string): Box {
	const [x = 0, y = 0, w = 100, h = 100] = viewBox.trim().split(/[\s,]+/).map(Number);
	return { x, y, w, h };
}

// ---- path data ⇄ anchors ----

const PATH_TOKEN = /([MmLlHhVvCcSsQqTtAaZz])|(-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?)/g;

/**
 * Parse SVG path data into subpaths of anchors. All commands are normalized to
 * absolute cubics/lines (H/V/S/Q/T included; quadratics are raised to cubics).
 * Arcs are beyond this editor; their endpoint is kept as a straight segment.
 */
export function parsePath(d: string): SubPath[] {
	const tokens = [...d.matchAll(PATH_TOKEN)].map((m) => m[0]);
	const subs: SubPath[] = [];
	let sub: SubPath | null = null;
	let cur: Pt = { x: 0, y: 0 };
	let start: Pt = { x: 0, y: 0 };
	let prevCubicCtrl: Pt | null = null;
	let prevQuadCtrl: Pt | null = null;
	let cmd = '';
	let at = 0;

	const num = () => Number(tokens[at++]);
	const open = (pt: Pt): SubPath => {
		const fresh: SubPath = { closed: false, anchors: [{ x: pt.x, y: pt.y }] };
		subs.push(fresh);
		start = pt;
		return fresh;
	};
	const lineTo = (pt: Pt) => {
		if (!sub) {
			sub = open(cur);
		}
		sub.anchors.push({ x: pt.x, y: pt.y });
		cur = pt;
	};
	const cubicTo = (c1: Pt, c2: Pt, pt: Pt) => {
		if (!sub) {
			sub = open(cur);
		}
		sub.anchors[sub.anchors.length - 1].out = c1;
		sub.anchors.push({ x: pt.x, y: pt.y, in: c2 });
		cur = pt;
	};

	while (at < tokens.length) {
		const token = tokens[at];
		if (/^[A-Za-z]$/.test(token)) {
			cmd = token;
			at++;
			if (cmd === 'Z' || cmd === 'z') {
				const closing: SubPath | null = sub;
				if (closing) {
					// a Z whose start equals the last anchor collapses the duplicate
					const first = closing.anchors[0];
					const tail = closing.anchors[closing.anchors.length - 1];
					if (Math.hypot(tail.x - first.x, tail.y - first.y) < 1e-6) {
						first.in = tail.in;
						closing.anchors.pop();
					}
					closing.closed = true;
					sub = null;
				}
				cur = start;
				prevCubicCtrl = prevQuadCtrl = null;
				continue;
			}
		} else if (cmd === 'M') {
			cmd = 'L';  // implicit lineto after a moveto's first pair
		} else if (cmd === 'm') {
			cmd = 'l';
		}

		const rel = cmd === cmd.toLowerCase();
		const base = rel ? cur : { x: 0, y: 0 };
		switch (cmd.toUpperCase()) {
			case 'M': {
				const pt = { x: base.x + num(), y: base.y + num() };
				sub = open(pt);
				cur = pt;
				prevCubicCtrl = prevQuadCtrl = null;
				break;
			}
			case 'L': {
				lineTo({ x: base.x + num(), y: base.y + num() });
				prevCubicCtrl = prevQuadCtrl = null;
				break;
			}
			case 'H': {
				lineTo({ x: base.x + num(), y: cur.y });
				prevCubicCtrl = prevQuadCtrl = null;
				break;
			}
			case 'V': {
				lineTo({ x: cur.x, y: (rel ? cur.y : 0) + num() });
				prevCubicCtrl = prevQuadCtrl = null;
				break;
			}
			case 'C': {
				const c1 = { x: base.x + num(), y: base.y + num() };
				const c2 = { x: base.x + num(), y: base.y + num() };
				const pt = { x: base.x + num(), y: base.y + num() };
				cubicTo(c1, c2, pt);
				prevCubicCtrl = c2;
				prevQuadCtrl = null;
				break;
			}
			case 'S': {
				const c1 = prevCubicCtrl ? { x: 2 * cur.x - prevCubicCtrl.x, y: 2 * cur.y - prevCubicCtrl.y } : { ...cur };
				const c2 = { x: base.x + num(), y: base.y + num() };
				const pt = { x: base.x + num(), y: base.y + num() };
				cubicTo(c1, c2, pt);
				prevCubicCtrl = c2;
				prevQuadCtrl = null;
				break;
			}
			case 'Q': {
				const q = { x: base.x + num(), y: base.y + num() };
				const pt = { x: base.x + num(), y: base.y + num() };
				cubicTo(
					{ x: cur.x + (2 / 3) * (q.x - cur.x), y: cur.y + (2 / 3) * (q.y - cur.y) },
					{ x: pt.x + (2 / 3) * (q.x - pt.x), y: pt.y + (2 / 3) * (q.y - pt.y) },
					pt,
				);
				prevQuadCtrl = q;
				prevCubicCtrl = null;
				break;
			}
			case 'T': {
				const q: Pt = prevQuadCtrl ? { x: 2 * cur.x - prevQuadCtrl.x, y: 2 * cur.y - prevQuadCtrl.y } : { ...cur };
				const pt = { x: base.x + num(), y: base.y + num() };
				cubicTo(
					{ x: cur.x + (2 / 3) * (q.x - cur.x), y: cur.y + (2 / 3) * (q.y - cur.y) },
					{ x: pt.x + (2 / 3) * (q.x - pt.x), y: pt.y + (2 / 3) * (q.y - pt.y) },
					pt,
				);
				prevQuadCtrl = q;
				prevCubicCtrl = null;
				break;
			}
			case 'A': {
				// rx ry rot large sweep x y: endpoint only, flattened to a line
				num(); num(); num(); num(); num();
				lineTo({ x: base.x + num(), y: base.y + num() });
				prevCubicCtrl = prevQuadCtrl = null;
				break;
			}
			default:
				at++;
		}
	}

	return subs.filter((s) => s.anchors.length > 0);
}

export function serializePath(subs: SubPath[]): string {
	const pt = (p: Pt) => `${round2(p.x)} ${round2(p.y)}`;
	const parts: string[] = [];
	for (const sub of subs) {
		if (!sub.anchors.length) {
			continue;
		}
		parts.push(`M${pt(sub.anchors[0])}`);
		const seg = (a: Anchor, b: Anchor) =>
			(a.out || b.in)
				? `C${pt(a.out ?? a)} ${pt(b.in ?? b)} ${pt(b)}`
				: `L${pt(b)}`;
		for (let i = 1; i < sub.anchors.length; i++) {
			parts.push(seg(sub.anchors[i - 1], sub.anchors[i]));
		}
		if (sub.closed) {
			const a = sub.anchors[sub.anchors.length - 1];
			const b = sub.anchors[0];
			if (a.out || b.in) {
				parts.push(seg(a, b));
			}
			parts.push('Z');
		}
	}
	return parts.join(' ');
}

/** The cubic's effective control points for the segment a→b. */
export function segmentCtrl(a: Anchor, b: Anchor): [Pt, Pt, Pt, Pt] {
	return [{ x: a.x, y: a.y }, a.out ?? { x: a.x, y: a.y }, b.in ?? { x: b.x, y: b.y }, { x: b.x, y: b.y }];
}

export function cubicAt([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
	const u = 1 - t;
	return {
		x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
		y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
	};
}

/** The t on segment a→b nearest to pt (sampled, plenty for hit targets). */
export function nearestT(a: Anchor, b: Anchor, target: Pt): number {
	const ctrl = segmentCtrl(a, b);
	let best = 0;
	let bestDist = Infinity;
	for (let i = 0; i <= 48; i++) {
		const t = i / 48;
		const p = cubicAt(ctrl, t);
		const dist = Math.hypot(p.x - target.x, p.y - target.y);
		if (dist < bestDist) {
			bestDist = dist;
			best = t;
		}
	}
	return best;
}

/** de Casteljau split: a new anchor at t on the segment after `idx`. */
export function splitSegment(sub: SubPath, idx: number, t: number): SubPath {
	const anchors = sub.anchors.map((a) => ({ ...a }));
	const a = anchors[idx];
	const b = anchors[(idx + 1) % anchors.length];
	const [p0, p1, p2, p3] = segmentCtrl(a, b);
	const lerp = (m: Pt, n: Pt): Pt => ({ x: m.x + (n.x - m.x) * t, y: m.y + (n.y - m.y) * t });
	const p01 = lerp(p0, p1);
	const p12 = lerp(p1, p2);
	const p23 = lerp(p2, p3);
	const p012 = lerp(p01, p12);
	const p123 = lerp(p12, p23);
	const mid = lerp(p012, p123);
	const wasCurve = Boolean(a.out || b.in);
	if (wasCurve) {
		a.out = p01;
		b.in = p23;
	}
	const fresh: Anchor = wasCurve
		? { x: mid.x, y: mid.y, in: p012, out: p123 }
		: { x: mid.x, y: mid.y };
	anchors.splice(idx + 1, 0, fresh);
	return { ...sub, anchors };
}

/**
 * Bow the segment after `idx` so its point at t follows the pointer: the delta
 * lands on the two control points weighted by their Bernstein pull at t
 * (w1 = 3(1-t)^2 t, w2 = 3(1-t)t^2, ctrl += delta * w / (w1^2 + w2^2)), which
 * makes the grabbed point track the pointer exactly. A handleless (line)
 * segment first grows handles at the 1/3 and 2/3 lerp points: the move that
 * pulls a curve out of a rigid shape.
 */
export function bendSegment(sub: SubPath, idx: number, t: number, delta: Pt): SubPath {
	const anchors = sub.anchors.map((a) => ({ ...a }));
	const a = anchors[idx];
	const b = anchors[(idx + 1) % anchors.length];
	if (!a.out && !b.in) {
		a.out = { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 };
		b.in = { x: a.x + (2 * (b.x - a.x)) / 3, y: a.y + (2 * (b.y - a.y)) / 3 };
	}
	// a grab at the very ends has no leverage on the controls; keep t inboard
	const tc = Math.min(0.9, Math.max(0.1, t));
	const w1 = 3 * (1 - tc) * (1 - tc) * tc;
	const w2 = 3 * (1 - tc) * tc * tc;
	const norm = w1 * w1 + w2 * w2;
	const c1 = a.out ?? { x: a.x, y: a.y };
	const c2 = b.in ?? { x: b.x, y: b.y };
	a.out = { x: c1.x + (delta.x * w1) / norm, y: c1.y + (delta.y * w1) / norm };
	b.in = { x: c2.x + (delta.x * w2) / norm, y: c2.y + (delta.y * w2) / norm };
	return { ...sub, anchors };
}

/** Drop the anchor's handles: a hard corner. */
export function cornerNode(sub: SubPath, idx: number): SubPath {
	const anchors = sub.anchors.map((a, ai) => (ai === idx ? { x: a.x, y: a.y } : { ...a }));
	return { ...sub, anchors };
}

/**
 * Grow tangent-aligned handles on the anchor: the tangent is the normalized
 * prev→next chord, each handle a third of its neighbor distance long. An open
 * end has one neighbor, so only that side gets a handle.
 */
export function smoothNode(sub: SubPath, idx: number): SubPath {
	const anchors = sub.anchors.map((a) => ({ ...a }));
	const n = anchors.length;
	const a = anchors[idx];
	const prev = sub.closed || idx > 0 ? anchors[(idx - 1 + n) % n] : null;
	const next = sub.closed || idx < n - 1 ? anchors[(idx + 1) % n] : null;
	const from = prev ?? a;
	const to = next ?? a;
	const chord = Math.hypot(to.x - from.x, to.y - from.y);
	if (chord < 1e-9) {
		return { ...sub, anchors };
	}
	const tx = (to.x - from.x) / chord;
	const ty = (to.y - from.y) / chord;
	if (prev) {
		const len = Math.hypot(a.x - prev.x, a.y - prev.y) / 3;
		a.in = { x: a.x - tx * len, y: a.y - ty * len };
	}
	if (next) {
		const len = Math.hypot(next.x - a.x, next.y - a.y) / 3;
		a.out = { x: a.x + tx * len, y: a.y + ty * len };
	}
	return { ...sub, anchors };
}

// ---- transforms (baked into coordinates, shapes carry no transform) ----

type PtFn = (p: Pt) => Pt;

function mapAnchors(d: string, fn: PtFn): string {
	return serializePath(parsePath(d).map((sub) => ({
		...sub,
		anchors: sub.anchors.map((a) => ({
			...fn(a),
			in:  a.in ? fn(a.in) : undefined,
			out: a.out ? fn(a.out) : undefined,
		})),
	})));
}

export function translateShape(s: Shape, dx: number, dy: number): Shape {
	const moved = { ...s };
	if (s.type === 'path') {
		moved.d = mapAnchors(s.d ?? '', (p) => ({ x: p.x + dx, y: p.y + dy }));
	} else if (s.type === 'ellipse') {
		moved.cx = round2((s.cx ?? 0) + dx);
		moved.cy = round2((s.cy ?? 0) + dy);
	} else if (s.type === 'rect') {
		moved.x = round2((s.x ?? 0) + dx);
		moved.y = round2((s.y ?? 0) + dy);
	} else {
		moved.x1 = round2((s.x1 ?? 0) + dx);
		moved.y1 = round2((s.y1 ?? 0) + dy);
		moved.x2 = round2((s.x2 ?? 0) + dx);
		moved.y2 = round2((s.y2 ?? 0) + dy);
	}
	if (s.origin) {
		moved.origin = [round2(s.origin[0] + dx), round2(s.origin[1] + dy)];
	}
	return moved;
}

export function scaleShape(s: Shape, sx: number, sy: number, cx: number, cy: number): Shape {
	const fn: PtFn = (p) => ({ x: cx + (p.x - cx) * sx, y: cy + (p.y - cy) * sy });
	const scaled = { ...s };
	if (s.type === 'path') {
		scaled.d = mapAnchors(s.d ?? '', fn);
	} else if (s.type === 'ellipse') {
		const c = fn({ x: s.cx ?? 0, y: s.cy ?? 0 });
		scaled.cx = round2(c.x);
		scaled.cy = round2(c.y);
		scaled.rx = round2(Math.max(0.05, (s.rx ?? 0) * Math.abs(sx)));
		scaled.ry = round2(Math.max(0.05, (s.ry ?? 0) * Math.abs(sy)));
	} else if (s.type === 'rect') {
		const a = fn({ x: s.x ?? 0, y: s.y ?? 0 });
		const b = fn({ x: (s.x ?? 0) + (s.w ?? 0), y: (s.y ?? 0) + (s.h ?? 0) });
		scaled.x = round2(Math.min(a.x, b.x));
		scaled.y = round2(Math.min(a.y, b.y));
		scaled.w = round2(Math.abs(b.x - a.x));
		scaled.h = round2(Math.abs(b.y - a.y));
	} else {
		const a = fn({ x: s.x1 ?? 0, y: s.y1 ?? 0 });
		const b = fn({ x: s.x2 ?? 0, y: s.y2 ?? 0 });
		scaled.x1 = round2(a.x);
		scaled.y1 = round2(a.y);
		scaled.x2 = round2(b.x);
		scaled.y2 = round2(b.y);
	}
	if (s.origin) {
		const o = fn({ x: s.origin[0], y: s.origin[1] });
		scaled.origin = [round2(o.x), round2(o.y)];
	}
	return scaled;
}

/**
 * Rotate about a center. Paths and lines rotate their points; a rect or
 * ellipse has no rotated form in the contract, so it is baked to a path first.
 */
export function rotateShape(s: Shape, angle: number, cx: number, cy: number): Shape {
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	const fn: PtFn = (p) => ({
		x: cx + (p.x - cx) * cos - (p.y - cy) * sin,
		y: cy + (p.x - cx) * sin + (p.y - cy) * cos,
	});
	const src = s.type === 'rect' || s.type === 'ellipse' ? toPathShape(s) : s;
	const rotated = { ...src };
	if (src.type === 'path') {
		rotated.d = mapAnchors(src.d ?? '', fn);
	} else {
		const a = fn({ x: src.x1 ?? 0, y: src.y1 ?? 0 });
		const b = fn({ x: src.x2 ?? 0, y: src.y2 ?? 0 });
		rotated.x1 = round2(a.x);
		rotated.y1 = round2(a.y);
		rotated.x2 = round2(b.x);
		rotated.y2 = round2(b.y);
	}
	if (src.origin) {
		const o = fn({ x: src.origin[0], y: src.origin[1] });
		rotated.origin = [round2(o.x), round2(o.y)];
	}
	return rotated;
}

const KAPPA = 0.5522847498;

/** Bake a rect or ellipse into an equivalent closed path shape. */
export function toPathShape(s: Shape): Shape {
	if (s.type === 'rect') {
		const { x = 0, y = 0, w = 0, h = 0, ...rest } = s;
		return {
			...rest, type: 'path',
			d: serializePath([{ closed: true, anchors: [
				{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
			] }]),
		};
	}
	if (s.type === 'ellipse') {
		const { cx = 0, cy = 0, rx = 0, ry = 0, ...rest } = s;
		const kx = rx * KAPPA;
		const ky = ry * KAPPA;
		return {
			...rest, type: 'path',
			d: serializePath([{ closed: true, anchors: [
				{ x: cx + rx, y: cy, in: { x: cx + rx, y: cy + ky }, out: { x: cx + rx, y: cy - ky } },
				{ x: cx, y: cy - ry, in: { x: cx + kx, y: cy - ry }, out: { x: cx - kx, y: cy - ry } },
				{ x: cx - rx, y: cy, in: { x: cx - rx, y: cy - ky }, out: { x: cx - rx, y: cy + ky } },
				{ x: cx, y: cy + ry, in: { x: cx - kx, y: cy + ry }, out: { x: cx + kx, y: cy + ry } },
			] }]),
		};
	}
	return s;
}

// ---- bounding boxes ----

export function shapeBox(s: Shape): Box {
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -Infinity;
	let maxY = -Infinity;
	const take = (p: Pt) => {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	};
	if (s.type === 'path') {
		for (const sub of parsePath(s.d ?? '')) {
			const n = sub.anchors.length;
			const segs = sub.closed ? n : n - 1;
			if (n === 1) {
				take(sub.anchors[0]);
			}
			for (let i = 0; i < segs; i++) {
				const ctrl = segmentCtrl(sub.anchors[i], sub.anchors[(i + 1) % n]);
				for (let k = 0; k <= 16; k++) {
					take(cubicAt(ctrl, k / 16));
				}
			}
		}
	} else if (s.type === 'ellipse') {
		take({ x: (s.cx ?? 0) - (s.rx ?? 0), y: (s.cy ?? 0) - (s.ry ?? 0) });
		take({ x: (s.cx ?? 0) + (s.rx ?? 0), y: (s.cy ?? 0) + (s.ry ?? 0) });
	} else if (s.type === 'rect') {
		take({ x: s.x ?? 0, y: s.y ?? 0 });
		take({ x: (s.x ?? 0) + (s.w ?? 0), y: (s.y ?? 0) + (s.h ?? 0) });
	} else {
		take({ x: s.x1 ?? 0, y: s.y1 ?? 0 });
		take({ x: s.x2 ?? 0, y: s.y2 ?? 0 });
	}
	if (minX > maxX) {
		return { x: 0, y: 0, w: 0, h: 0 };
	}
	return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ---- freehand smoothing: simplify, then fit to smooth cubics ----

function rdp(points: Pt[], epsilon: number): Pt[] {
	if (points.length < 3) {
		return points;
	}
	const first = points[0];
	const last = points[points.length - 1];
	let farthest = 0;
	let farthestAt = 0;
	const dx = last.x - first.x;
	const dy = last.y - first.y;
	const len = Math.hypot(dx, dy) || 1e-9;
	for (let i = 1; i < points.length - 1; i++) {
		const p = points[i];
		const dist = Math.abs(dy * p.x - dx * p.y + last.x * first.y - last.y * first.x) / len;
		if (dist > farthest) {
			farthest = dist;
			farthestAt = i;
		}
	}
	if (farthest <= epsilon) {
		return [first, last];
	}
	const head = rdp(points.slice(0, farthestAt + 1), epsilon);
	const tail = rdp(points.slice(farthestAt), epsilon);
	return [...head.slice(0, -1), ...tail];
}

/**
 * Turn a raw pointer trace into a smooth open bezier path: Ramer-Douglas-
 * Peucker to shed jitter, then Catmull-Rom tangents for the handles:
 * smoothness over fidelity, per the shop's charter.
 */
export function fitPencil(points: Pt[], epsilon: number): SubPath | null {
	const pts = rdp(points, epsilon);
	if (pts.length < 2) {
		return null;
	}
	const anchors: Anchor[] = pts.map((p, i) => {
		const prev = pts[Math.max(0, i - 1)];
		const next = pts[Math.min(pts.length - 1, i + 1)];
		const tx = (next.x - prev.x) / 6;
		const ty = (next.y - prev.y) / 6;
		return {
			x: p.x, y: p.y,
			in:  i > 0 ? { x: p.x - tx, y: p.y - ty } : undefined,
			out: i < pts.length - 1 ? { x: p.x + tx, y: p.y + ty } : undefined,
		};
	});
	return { closed: false, anchors };
}

// ---- wire hygiene ----

const SHAPE_FIELDS: Record<Shape['type'], (keyof Shape)[]> = {
	path:    ['d'],
	ellipse: ['cx', 'cy', 'rx', 'ry'],
	rect:    ['x', 'y', 'w', 'h'],
	line:    ['x1', 'y1', 'x2', 'y2'],
};

const KNOWN_SHAPE_TYPES = new Set<string>(Object.keys(SHAPE_FIELDS));

/**
 * Strip fields that don't belong to the shape's type and everything unset;
 * renderers write only the fields present (contract), so a rect that was once
 * an ellipse must not drag stale cx/cy onto the wire.
 */
export function cleanShape(s: Shape): Shape {
	const out: Shape = { id: s.id, type: s.type };
	for (const key of SHAPE_FIELDS[s.type]) {
		const value = s[key];
		if (value !== undefined) {
			(out[key] as unknown) = typeof value === 'number' ? round2(value) : value;
		}
	}
	if (s.fill !== undefined) {
		out.fill = s.fill;
	}
	if (s.stroke !== undefined) {
		out.stroke = s.stroke;
	}
	if (s.strokeWidth !== undefined) {
		out.strokeWidth = round2(s.strokeWidth);
	}
	if (s.opacity !== undefined && s.opacity !== 1) {
		out.opacity = round2(s.opacity);
	}
	if (s.linecap !== undefined) {
		out.linecap = s.linecap;
	}
	if (s.linejoin !== undefined) {
		out.linejoin = s.linejoin;
	}
	if (s.role !== undefined) {
		out.role = s.role;
	}
	if (s.origin !== undefined) {
		out.origin = [round2(s.origin[0]), round2(s.origin[1])];
	}
	return out;
}

// ---- carving round-trip: shape model ⇄ raw svg with a metadata island ----
//
// The carving wire stays raw SVG on the existing CRUD; an editor-born carving
// serializes its shape model to real svg elements AND embeds the model as a
// <metadata> island so reopening restores full editability. Reading the island
// is not svg parsing: it lifts back the JSON we wrote. A carving without the
// island (a seed, hand-pasted markup) is canvas-locked, never parsed.

export const CARVING_MODEL_ID = 'argsea-carving-model';

const MODEL_ISLAND = new RegExp(`<metadata id="${CARVING_MODEL_ID}">[\\s\\S]*?</metadata>`, 'gi');

/** Drop our own model island from a raw carving svg, leaving the rest of the markup intact. */
export function stripCarvingModel(svg: string): string {
	return svg.replace(MODEL_ISLAND, '');
}

const xmlText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const unXmlText = (s: string): string => s.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

function attr(name: string, value: string | number | undefined): string {
	return value === undefined ? '' : ` ${name}="${value}"`;
}

/** One shape as an svg element string; mirrors ShapeNode, only present fields written. */
export function shapeMarkup(s: Shape): string {
	const common =
		attr('fill', s.fill) + attr('stroke', s.stroke) + attr('stroke-width', s.strokeWidth) +
		attr('opacity', s.opacity) + attr('stroke-linecap', s.linecap) + attr('stroke-linejoin', s.linejoin);
	switch (s.type) {
		case 'path':    return `<path d="${s.d ?? ''}"${common}/>`;
		case 'ellipse': return `<ellipse cx="${s.cx ?? 0}" cy="${s.cy ?? 0}" rx="${s.rx ?? 0}" ry="${s.ry ?? 0}"${common}/>`;
		case 'rect':    return `<rect x="${s.x ?? 0}" y="${s.y ?? 0}" width="${s.w ?? 0}" height="${s.h ?? 0}"${common}/>`;
		case 'line':    return `<line x1="${s.x1 ?? 0}" y1="${s.y1 ?? 0}" x2="${s.x2 ?? 0}" y2="${s.y2 ?? 0}"${common}/>`;
	}
}

/** The shape model as a full raw svg string, its model embedded as a metadata island. */
export function carvingSvg(viewBox: string, shapes: Shape[]): string {
	const box = parseViewBox(viewBox);
	const body = shapes.map(shapeMarkup).join('');
	const model = xmlText(JSON.stringify({ viewBox, shapes: shapes.map(cleanShape) }));
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${round2(box.w)}" height="${round2(box.h)}" fill="none">${body}<metadata id="${CARVING_MODEL_ID}">${model}</metadata></svg>`;
}

export interface CarvingModel {
	viewBox: string;
	shapes:  Shape[];
}

/** Lift the embedded model back out of a raw carving svg; null when it has no island. */
export function readCarvingModel(svg: string): CarvingModel | null {
	const island = svg.match(new RegExp(`<metadata id="${CARVING_MODEL_ID}">([\\s\\S]*?)</metadata>`, 'i'));
	if (!island) {
		return null;
	}
	try {
		const parsed = JSON.parse(unXmlText(island[1]));
		if (!parsed || !Array.isArray(parsed.shapes)) {
			return null;
		}
		// only shapes of a type we know how to render survive: an unknown type would
		// serialize to the literal string "undefined" through shapeMarkup on next save
		const shapes = (parsed.shapes as unknown[]).filter((s): s is Shape =>
			Boolean(s) && KNOWN_SHAPE_TYPES.has((s as { type?: string }).type ?? ''));
		return { viewBox: String(parsed.viewBox ?? '0 0 40 40'), shapes };
	} catch {
		return null;
	}
}

/** The viewBox of a raw svg, falling back to its width/height, then 40x40. */
export function svgViewBox(raw: string): string {
	const vb = raw.match(/viewBox\s*=\s*"([^"]*)"/i);
	if (vb) {
		return vb[1].trim();
	}
	const w = raw.match(/\bwidth\s*=\s*"([\d.]+)"/i);
	const h = raw.match(/\bheight\s*=\s*"([\d.]+)"/i);
	return `0 0 ${w?.[1] ?? '40'} ${h?.[1] ?? '40'}`;
}

/** The inner markup of a raw svg, with any of our own model island stripped. */
export function svgInner(raw: string): string {
	return stripCarvingModel(raw
		.replace(/^[\s\S]*?<svg[^>]*>/i, '')
		.replace(/<\/svg>\s*$/i, ''));
}

// ---- raw svg → shapes: the "carve it loose" import ----
//
// The one place raw markup IS parsed: a deliberate import into the shape
// model, never a silent one. Everything drawable becomes a path shape (so
// group transforms bake into plain coordinates); whatever the editor cannot
// hold is named in `lost` instead of being quietly mangled.

export interface ParsedSvg {
	viewBox: string;
	shapes:  Shape[];
	lost:    string[];
}

// column-major 2x3 affine, svg's own (a b c d e f) order
type Mat = [number, number, number, number, number, number];

const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

function matMul(m: Mat, n: Mat): Mat {
	return [
		m[0] * n[0] + m[2] * n[1],
		m[1] * n[0] + m[3] * n[1],
		m[0] * n[2] + m[2] * n[3],
		m[1] * n[2] + m[3] * n[3],
		m[0] * n[4] + m[2] * n[5] + m[4],
		m[1] * n[4] + m[3] * n[5] + m[5],
	];
}

function matApply(m: Mat, p: Pt): Pt {
	return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

const TRANSFORM_FN = /([a-zA-Z]+)\s*\(([^)]*)\)/g;

function parseTransform(value: string, lost: string[]): Mat {
	let m = IDENTITY;
	for (const [, fn, argStr] of value.matchAll(TRANSFORM_FN)) {
		const args = argStr.trim().split(/[\s,]+/).filter(Boolean).map(Number);
		switch (fn) {
			case 'translate':
				m = matMul(m, [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0]);
				break;
			case 'scale':
				m = matMul(m, [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]);
				break;
			case 'rotate': {
				const rad = ((args[0] ?? 0) * Math.PI) / 180;
				const cos = Math.cos(rad);
				const sin = Math.sin(rad);
				const cx = args[1] ?? 0;
				const cy = args[2] ?? 0;
				m = matMul(m, [1, 0, 0, 1, cx, cy]);
				m = matMul(m, [cos, sin, -sin, cos, 0, 0]);
				m = matMul(m, [1, 0, 0, 1, -cx, -cy]);
				break;
			}
			case 'matrix':
				if (args.length === 6) {
					m = matMul(m, args as Mat);
				}
				break;
			default:
				lost.push(`${fn} transform`);
		}
	}
	return m;
}

const CAPS = new Set(['butt', 'round', 'square']);
const JOINS = new Set(['miter', 'round', 'bevel']);

/** The element's carried style over what it inherits: fill/stroke/width/opacity/cap/join. */
function carriedStyle(el: Element, inherited: Partial<Shape>): Partial<Shape> {
	const style: Partial<Shape> = { ...inherited };
	const fill = el.getAttribute('fill');
	if (fill !== null) {
		style.fill = fill;
	}
	const stroke = el.getAttribute('stroke');
	if (stroke !== null) {
		style.stroke = stroke;
	}
	const width = Number(el.getAttribute('stroke-width') ?? NaN);
	if (!Number.isNaN(width)) {
		style.strokeWidth = width;
	}
	const opacity = Number(el.getAttribute('opacity') ?? NaN);
	if (!Number.isNaN(opacity)) {
		style.opacity = opacity;
	}
	const cap = el.getAttribute('stroke-linecap');
	if (cap && CAPS.has(cap)) {
		style.linecap = cap as Linecap;
	}
	const join = el.getAttribute('stroke-linejoin');
	if (join && JOINS.has(join)) {
		style.linejoin = join as Linejoin;
	}
	return style;
}

const numAttr = (el: Element, name: string): number => Number(el.getAttribute(name)) || 0;

function parsePoints(value: string): Pt[] {
	const nums = value.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
	const pts: Pt[] = [];
	for (let i = 0; i + 1 < nums.length; i += 2) {
		pts.push({ x: nums[i], y: nums[i + 1] });
	}
	return pts;
}

/** One drawable element as subpaths; null when this editor has no chisel for it. */
function elementSubPaths(el: Element, lost: string[]): SubPath[] | null {
	switch (el.tagName.toLowerCase()) {
		case 'path': {
			const d = el.getAttribute('d') ?? '';
			if (/[Aa]/.test(d)) {
				lost.push('arc segments (straightened)');
			}
			return parsePath(d);
		}
		case 'rect': {
			if (el.getAttribute('rx') || el.getAttribute('ry')) {
				lost.push('rounded rect corners');
			}
			const rect = toPathShape({
				id: '', type: 'rect',
				x: numAttr(el, 'x'), y: numAttr(el, 'y'), w: numAttr(el, 'width'), h: numAttr(el, 'height'),
			});
			return parsePath(rect.d ?? '');
		}
		case 'circle': {
			const r = numAttr(el, 'r');
			const disc = toPathShape({ id: '', type: 'ellipse', cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'), rx: r, ry: r });
			return parsePath(disc.d ?? '');
		}
		case 'ellipse': {
			const oval = toPathShape({
				id: '', type: 'ellipse',
				cx: numAttr(el, 'cx'), cy: numAttr(el, 'cy'), rx: numAttr(el, 'rx'), ry: numAttr(el, 'ry'),
			});
			return parsePath(oval.d ?? '');
		}
		case 'line':
			return [{ closed: false, anchors: [
				{ x: numAttr(el, 'x1'), y: numAttr(el, 'y1') },
				{ x: numAttr(el, 'x2'), y: numAttr(el, 'y2') },
			] }];
		case 'polyline': {
			const pts = parsePoints(el.getAttribute('points') ?? '');
			return pts.length >= 2 ? [{ closed: false, anchors: pts.map((p) => ({ ...p })) }] : [];
		}
		case 'polygon': {
			const pts = parsePoints(el.getAttribute('points') ?? '');
			return pts.length >= 2 ? [{ closed: true, anchors: pts.map((p) => ({ ...p })) }] : [];
		}
		default:
			return null;
	}
}

// invisible bookkeeping tags; skipping them loses nothing worth naming
const SKIPPED_SILENTLY = new Set(['title', 'desc', 'metadata']);

// visual baggage the shape model has no field for
const LOST_ATTRS = ['style', 'stroke-dasharray', 'filter', 'clip-path', 'mask'];

function walkSvg(el: Element, matrix: Mat, inherited: Partial<Shape>, shapes: Shape[], lost: string[]): void {
	for (const child of Array.from(el.children)) {
		const tag = child.tagName.toLowerCase();
		if (SKIPPED_SILENTLY.has(tag)) {
			continue;
		}
		for (const name of LOST_ATTRS) {
			if (child.hasAttribute(name)) {
				lost.push(name === 'style' ? 'style attributes' : name);
			}
		}
		const transform = child.getAttribute('transform');
		const m = transform ? matMul(matrix, parseTransform(transform, lost)) : matrix;
		if (tag === 'g') {
			walkSvg(child, m, carriedStyle(child, inherited), shapes, lost);
			continue;
		}
		const subs = elementSubPaths(child, lost);
		if (!subs) {
			lost.push(`<${tag}>`);
			continue;
		}
		if (!subs.length) {
			continue;
		}
		const baked = subs.map((sub) => ({
			...sub,
			anchors: sub.anchors.map((a) => ({
				...matApply(m, a),
				in:  a.in ? matApply(m, a.in) : undefined,
				out: a.out ? matApply(m, a.out) : undefined,
			})),
		}));
		shapes.push({ id: `loose-${shapes.length + 1}`, type: 'path', d: serializePath(baked), ...carriedStyle(child, inherited) });
	}
}

/** Parse a raw svg document into editable shapes; whatever cannot survive is named in `lost`. */
export function parseSvg(raw: string): ParsedSvg {
	const viewBox = svgViewBox(raw);
	const shapes: Shape[] = [];
	const lost: string[] = [];
	const doc = new DOMParser().parseFromString(stripCarvingModel(raw), 'image/svg+xml');
	const root = doc.documentElement;
	if (root.tagName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
		return { viewBox, shapes, lost: ['markup the parser could not read'] };
	}
	walkSvg(root, IDENTITY, carriedStyle(root, {}), shapes, lost);
	return { viewBox, shapes, lost: [...new Set(lost)] };
}
