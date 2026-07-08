// The figurehead editor: a touch-first SVG canvas over the contract's shape
// JSON. One pointer model for mouse and touch: single pointer drives the
// active tool, a second finger always pinches the view. Transforms bake into
// coordinates (shapes carry no transform field, by contract), history is
// immutable snapshots of the shapes array, and saving is explicit; designs
// are documents, not copy fields.
import { useEffect, useRef, useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { FigureheadPose, Linecap, Linejoin, Shape, ShapeRole } from '../lib/api';
import type { Pt, SubPath } from '../lib/shapes';
import {
	cleanShape, fitPencil, nearestT, parsePath, parseViewBox, round2, rotateShape,
	scaleShape, segmentCtrl, serializePath, shapeBox, splitSegment, translateShape,
} from '../lib/shapes';

export interface EditorDoc {
	id:        string | null;
	pose:      FigureheadPose;
	label:     string;
	viewBox:   string;
	shapes:    Shape[];
	published: boolean;
	seed:      boolean;
}

/** Render one contract shape. Absent fields stay absent (the SVG default). */
export function ShapeNode({ s, override }: { s: Shape; override?: React.SVGAttributes<SVGElement> }) {
	const common: React.SVGAttributes<SVGElement> = {
		fill: s.fill, stroke: s.stroke, strokeWidth: s.strokeWidth, opacity: s.opacity,
		strokeLinecap: s.linecap, strokeLinejoin: s.linejoin, ...override,
	};
	switch (s.type) {
		case 'path':    return <path d={s.d} {...common} />;
		case 'ellipse': return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
		case 'rect':    return <rect x={s.x} y={s.y} width={s.w} height={s.h} {...common} />;
		case 'line':    return <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} />;
	}
}

type Tool = 'select' | 'nodes' | 'pen' | 'pencil' | 'ellipse' | 'rect' | 'line';

const TOOLS: { id: Tool; glyph: string; label: string }[] = [
	{ id: 'select',  glyph: '↖', label: 'select' },
	{ id: 'nodes',   glyph: '⌖', label: 'nodes' },
	{ id: 'pen',     glyph: '✒', label: 'pen' },
	{ id: 'pencil',  glyph: '✎', label: 'pencil' },
	{ id: 'ellipse', glyph: '◯', label: 'ellipse' },
	{ id: 'rect',    glyph: '▭', label: 'rect' },
	{ id: 'line',    glyph: '╱', label: 'line' },
];

// the cat's own inks, one tap away; anything else through the free input
const PALETTE = ['#232a4d', '#93a0e8', '#f0d9a8', '#5f6ec4'];

const ROLES: (ShapeRole | '')[] = ['', 'tail', 'eyes', 'body'];
const LINECAPS: Linecap[] = ['butt', 'round', 'square'];
const LINEJOINS: Linejoin[] = ['miter', 'round', 'bevel'];

interface View {
	scale: number;
	tx:    number;
	ty:    number;
}

interface StyleDefaults {
	fill:        string;
	stroke:      string;
	strokeWidth: number;
	opacity:     number;
	linecap:     Linecap;
	linejoin:    Linejoin;
}

interface NodeEditState {
	shapeId: string;
	subs:    SubPath[];
	sel:     { sub: number; idx: number } | null;
}

type Drag =
	| { kind: 'pan'; startClient: Pt; orig: View }
	| { kind: 'pinch'; d0: number; mid0: Pt; orig: View }
	| { kind: 'move'; id: string; start: Pt; orig: Shape; moved: boolean }
	| { kind: 'scale'; id: string; orig: Shape; fix: Pt; grab: Pt; hx: number; hy: number }
	| { kind: 'rotate'; id: string; orig: Shape; center: Pt; start: Pt }
	| { kind: 'draw'; shape: 'ellipse' | 'rect' | 'line'; start: Pt }
	| { kind: 'pencil'; pts: Pt[] }
	| { kind: 'anchor'; sub: number; idx: number; start: Pt; orig: SubPath[] }
	| { kind: 'handle'; sub: number; idx: number; which: 'in' | 'out' }
	| { kind: 'penHandle'; start: Pt; moved: boolean };

const clampScale = (s: number): number => Math.min(60, Math.max(0.15, s));

function makeDrawShape(kind: 'ellipse' | 'rect' | 'line', a: Pt, b: Pt, style: StyleDefaults): Shape {
	const base = {
		id: '', fill: style.fill, stroke: style.stroke, strokeWidth: style.strokeWidth,
		...(style.opacity !== 1 ? { opacity: style.opacity } : null),
	};
	if (kind === 'rect') {
		return {
			...base, type: 'rect',
			x: round2(Math.min(a.x, b.x)), y: round2(Math.min(a.y, b.y)),
			w: round2(Math.abs(b.x - a.x)), h: round2(Math.abs(b.y - a.y)),
		};
	}
	if (kind === 'ellipse') {
		return {
			...base, type: 'ellipse',
			cx: round2((a.x + b.x) / 2), cy: round2((a.y + b.y) / 2),
			rx: round2(Math.abs(b.x - a.x) / 2), ry: round2(Math.abs(b.y - a.y) / 2),
		};
	}
	const { fill: _fill, ...lineBase } = base;
	return {
		...lineBase, type: 'line', linecap: style.linecap,
		x1: round2(a.x), y1: round2(a.y), x2: round2(b.x), y2: round2(b.y),
	};
}

export default function ShapeEditor({ doc, onClose }: { doc: EditorDoc; onClose: () => void }) {
	const h = useHarbor();

	const [docId, setDocId] = useState(doc.id);
	const [meta, setMeta] = useState({ published: doc.published, seed: doc.seed });
	const [label, setLabel] = useState(doc.label);
	const [shapes, setShapesRaw] = useState<Shape[]>(doc.shapes);
	const [hist, setHist] = useState<Shape[][]>([doc.shapes]);
	const [histAt, setHistAt] = useState(0);
	// the last-saved snapshot; dirtiness is derived by identity, so undoing
	// back to the saved array reads clean again
	const [savedAt, setSavedAt] = useState<{ shapes: Shape[]; label: string }>({ shapes: doc.shapes, label: doc.label });
	const [tool, setTool] = useState<Tool>('select');
	const [selId, setSelId] = useState<string | null>(null);
	const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
	const [nodeEdit, setNodeEdit] = useState<NodeEditState | null>(null);
	const [penDraft, setPenDraft] = useState<SubPath | null>(null);
	const [pencilTrace, setPencilTrace] = useState<Pt[] | null>(null);
	const [preview, setPreview] = useState<Shape | null>(null);
	const [defaults, setDefaults] = useState<StyleDefaults>({
		fill: '#232a4d', stroke: '#93a0e8', strokeWidth: 1.6, opacity: 1, linecap: 'round', linejoin: 'round',
	});
	const [onionId, setOnionId] = useState('');
	const [armOrigin, setArmOrigin] = useState(false);

	// an armed origin without a target is meaningless; disarm with the selection
	useEffect(() => {
		if (!selId) {
			setArmOrigin(false);
		}
	}, [selId]);

	const svgRef = useRef<SVGSVGElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const drag = useRef<Drag | null>(null);
	const pointers = useRef(new Map<number, Pt>());
	// child pointerdowns note what was hit; the svg handler (bubbling after
	// them) consumes the note; pointer capture and the pointer map stay in
	// one place instead of being smeared over every overlay element
	const hitId = useRef<string | null>(null);
	const overlayHit = useRef<Drag | null>(null);
	// the freshest shapes across live drag updates; a pointerup in the same
	// frame as a pointermove must not commit a stale render's array
	const live = useRef<Shape[]>(doc.shapes);

	const vb = parseViewBox(doc.viewBox);
	const px = (n: number) => n / view.scale;  // screen pixels → world units

	const setShapesLive = (next: Shape[]) => {
		live.current = next;
		setShapesRaw(next);
	};

	const commit = (next: Shape[]) => {
		setShapesLive(next);
		const trimmed = hist.slice(0, histAt + 1);
		setHist([...trimmed, next]);
		setHistAt(trimmed.length);
	};

	const undo = () => {
		if (histAt > 0) {
			setHistAt(histAt - 1);
			setShapesLive(hist[histAt - 1]);
			setNodeEdit(null);
		}
	};

	const redo = () => {
		if (histAt < hist.length - 1) {
			setHistAt(histAt + 1);
			setShapesLive(hist[histAt + 1]);
			setNodeEdit(null);
		}
	};

	const dirty = shapes !== savedAt.shapes || label !== savedAt.label;

	const sel = selId ? shapes.find((s) => s.id === selId) ?? null : null;

	const patchShape = (id: string, patch: Partial<Shape>) => {
		commit(live.current.map((s) => (s.id === id ? { ...s, ...patch } : s)));
	};

	const freshId = (base: string): string => {
		let n = 1;
		while (live.current.some((s) => s.id === `${base}-${n}`)) {
			n++;
		}
		return `${base}-${n}`;
	};

	// ---- view transform ----

	const toWorld = (clientX: number, clientY: number): Pt => {
		const rect = svgRef.current!.getBoundingClientRect();
		return { x: (clientX - rect.left - view.tx) / view.scale, y: (clientY - rect.top - view.ty) / view.scale };
	};

	const fitView = () => {
		const wrap = wrapRef.current;
		if (!wrap) {
			return;
		}
		const w = wrap.clientWidth;
		const height = wrap.clientHeight;
		const scale = clampScale(Math.min((w - 56) / vb.w, (height - 56) / vb.h));
		setView({ scale, tx: (w - vb.w * scale) / 2 - vb.x * scale, ty: (height - vb.h * scale) / 2 - vb.y * scale });
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(fitView, []);

	const zoomAt = (clientX: number, clientY: number, factor: number) => {
		const rect = svgRef.current!.getBoundingClientRect();
		const scale = clampScale(view.scale * factor);
		const real = scale / view.scale;
		setView({
			scale,
			tx: (clientX - rect.left) - ((clientX - rect.left) - view.tx) * real,
			ty: (clientY - rect.top) - ((clientY - rect.top) - view.ty) * real,
		});
	};

	const zoomCenter = (factor: number) => {
		const rect = svgRef.current!.getBoundingClientRect();
		zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
	};

	// React's wheel listener is passive; attach our own so the page doesn't
	// scroll under a zoom gesture
	const zoomAtRef = useRef(zoomAt);
	zoomAtRef.current = zoomAt;
	useEffect(() => {
		const svg = svgRef.current;
		if (!svg) {
			return;
		}
		const onWheel = (e: WheelEvent) => {
			e.preventDefault();
			zoomAtRef.current(e.clientX, e.clientY, e.deltaY < 0 ? 1.18 : 1 / 1.18);
		};
		svg.addEventListener('wheel', onWheel, { passive: false });
		return () => svg.removeEventListener('wheel', onWheel);
	}, []);

	// ---- node editing plumbing ----

	const applySubs = (subs: SubPath[], edit: NodeEditState) => {
		setNodeEdit({ ...edit, subs });
		setShapesLive(live.current.map((s) => (s.id === edit.shapeId ? { ...s, d: serializePath(subs) } : s)));
	};

	const removeNode = () => {
		if (!nodeEdit?.sel) {
			return;
		}
		const subs = nodeEdit.subs.map((s) => ({ ...s, anchors: s.anchors.map((a) => ({ ...a })) }));
		subs[nodeEdit.sel.sub].anchors.splice(nodeEdit.sel.idx, 1);
		const kept = subs.filter((s) => s.anchors.length >= 2);
		if (!kept.length) {
			commit(live.current.filter((s) => s.id !== nodeEdit.shapeId));
			setNodeEdit(null);
			setSelId(null);
			return;
		}
		setNodeEdit({ ...nodeEdit, subs: kept, sel: null });
		commit(live.current.map((s) => (s.id === nodeEdit.shapeId ? { ...s, d: serializePath(kept) } : s)));
	};

	// ---- pen ----

	const finishPen = (closed: boolean) => {
		if (penDraft && penDraft.anchors.length >= 2) {
			const shape: Shape = {
				id: freshId('path'), type: 'path',
				d: serializePath([{ ...penDraft, closed }]),
				fill: closed ? defaults.fill : 'none',
				stroke: defaults.stroke, strokeWidth: defaults.strokeWidth,
				linecap: defaults.linecap, linejoin: defaults.linejoin,
				...(defaults.opacity !== 1 ? { opacity: defaults.opacity } : null),
			};
			commit([...live.current, shape]);
			setSelId(shape.id);
		}
		setPenDraft(null);
	};

	const penDown = (pt: Pt) => {
		if (penDraft && penDraft.anchors.length >= 2) {
			const first = penDraft.anchors[0];
			if (Math.hypot(pt.x - first.x, pt.y - first.y) < px(14)) {
				finishPen(true);
				return;
			}
		}
		setPenDraft({
			closed: false,
			anchors: [...(penDraft?.anchors ?? []), { x: round2(pt.x), y: round2(pt.y) }],
		});
		drag.current = { kind: 'penHandle', start: pt, moved: false };
	};

	// ---- pointer handling (one path for mouse, touch, and pen input) ----

	const abortDrag = () => {
		const d = drag.current;
		if (d && (d.kind === 'move' || d.kind === 'scale' || d.kind === 'rotate' || d.kind === 'anchor' || d.kind === 'handle')) {
			setShapesLive(hist[histAt]);
			setNodeEdit((ne) => (ne ? { ...ne, subs: parsePathOf(hist[histAt], ne.shapeId), sel: null } : ne));
		}
		if (d?.kind === 'penHandle') {
			// the pen placed this anchor on the same pointerdown, roll it back
			setPenDraft((cur) => (cur && cur.anchors.length > 1
				? { ...cur, anchors: cur.anchors.slice(0, -1) }
				: null));
		}
		setPreview(null);
		setPencilTrace(null);
		drag.current = null;
	};

	const parsePathOf = (list: Shape[], id: string): SubPath[] => {
		const s = list.find((x) => x.id === id);
		return s?.type === 'path' ? parsePath(s.d ?? '') : [];
	};

	const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

		if (pointers.current.size === 2) {
			// second finger: whatever was underway becomes a pinch
			abortDrag();
			overlayHit.current = null;
			hitId.current = null;
			const [a, b] = [...pointers.current.values()];
			drag.current = {
				kind: 'pinch',
				d0: Math.hypot(b.x - a.x, b.y - a.y) || 1,
				mid0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
				orig: view,
			};
			return;
		}
		if (pointers.current.size > 2) {
			// a third finger changes nothing, but a child pointerdown may have
			// noted a hit before this guard; drop it or the next single tap
			// consumes a stale note
			overlayHit.current = null;
			hitId.current = null;
			return;
		}

		// an armed origin tap outranks everything the tap might land on:
		// shapes, selection handles, the lot
		if (armOrigin && selId) {
			overlayHit.current = null;
			hitId.current = null;
			const spot = toWorld(e.clientX, e.clientY);
			patchShape(selId, { origin: [round2(spot.x), round2(spot.y)] });
			setArmOrigin(false);
			return;
		}

		if (overlayHit.current) {
			drag.current = overlayHit.current;
			overlayHit.current = null;
			hitId.current = null;
			return;
		}

		const hit = hitId.current;
		hitId.current = null;
		const pt = toWorld(e.clientX, e.clientY);

		switch (tool) {
			case 'select': {
				if (hit) {
					setSelId(hit);
					const orig = live.current.find((s) => s.id === hit)!;
					drag.current = { kind: 'move', id: hit, start: pt, orig, moved: false };
				} else {
					setSelId(null);
					drag.current = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, orig: view };
				}
				break;
			}
			case 'nodes': {
				if (hit) {
					const s = live.current.find((x) => x.id === hit)!;
					setSelId(hit);
					setNodeEdit(s.type === 'path' ? { shapeId: hit, subs: parsePath(s.d ?? ''), sel: null } : null);
				} else {
					drag.current = { kind: 'pan', startClient: { x: e.clientX, y: e.clientY }, orig: view };
				}
				break;
			}
			case 'pen': {
				penDown(pt);
				break;
			}
			case 'pencil': {
				drag.current = { kind: 'pencil', pts: [pt] };
				setPencilTrace([pt]);
				break;
			}
			default: {
				drag.current = { kind: 'draw', shape: tool, start: pt };
			}
		}
	};

	const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
		if (!pointers.current.has(e.pointerId)) {
			return;
		}
		pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
		const d = drag.current;
		if (!d) {
			return;
		}

		if (d.kind === 'pinch') {
			const pts = [...pointers.current.values()];
			if (pts.length < 2) {
				return;
			}
			const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
			const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
			const scale = clampScale(d.orig.scale * (dist / d.d0));
			const real = scale / d.orig.scale;
			// the world point that sat under the first midpoint stays under it
			const rect = svgRef.current!.getBoundingClientRect();
			setView({
				scale,
				tx: (mid.x - rect.left) - ((d.mid0.x - rect.left) - d.orig.tx) * real,
				ty: (mid.y - rect.top) - ((d.mid0.y - rect.top) - d.orig.ty) * real,
			});
			return;
		}

		const pt = toWorld(e.clientX, e.clientY);
		switch (d.kind) {
			case 'pan': {
				setView({
					scale: d.orig.scale,
					tx: d.orig.tx + (e.clientX - d.startClient.x),
					ty: d.orig.ty + (e.clientY - d.startClient.y),
				});
				break;
			}
			case 'move': {
				d.moved = true;
				const dx = pt.x - d.start.x;
				const dy = pt.y - d.start.y;
				setShapesLive(live.current.map((s) => (s.id === d.id ? translateShape(d.orig, dx, dy) : s)));
				break;
			}
			case 'scale': {
				const sx = d.hx ? (pt.x - d.fix.x) / ((d.grab.x - d.fix.x) || 1e-6) : 1;
				const sy = d.hy ? (pt.y - d.fix.y) / ((d.grab.y - d.fix.y) || 1e-6) : 1;
				setShapesLive(live.current.map((s) => (s.id === d.id ? scaleShape(d.orig, sx, sy, d.fix.x, d.fix.y) : s)));
				break;
			}
			case 'rotate': {
				const a0 = Math.atan2(d.start.y - d.center.y, d.start.x - d.center.x);
				const a1 = Math.atan2(pt.y - d.center.y, pt.x - d.center.x);
				setShapesLive(live.current.map((s) => (s.id === d.id ? rotateShape(d.orig, a1 - a0, d.center.x, d.center.y) : s)));
				break;
			}
			case 'draw': {
				setPreview(makeDrawShape(d.shape, d.start, pt, defaults));
				break;
			}
			case 'pencil': {
				d.pts.push(pt);
				setPencilTrace([...d.pts]);
				break;
			}
			case 'anchor': {
				if (!nodeEdit) {
					break;
				}
				const dx = pt.x - d.start.x;
				const dy = pt.y - d.start.y;
				const subs = d.orig.map((s, si) => ({
					...s,
					anchors: s.anchors.map((a, ai) => {
						if (si !== d.sub || ai !== d.idx) {
							return a;
						}
						return {
							x: a.x + dx, y: a.y + dy,
							in:  a.in ? { x: a.in.x + dx, y: a.in.y + dy } : undefined,
							out: a.out ? { x: a.out.x + dx, y: a.out.y + dy } : undefined,
						};
					}),
				}));
				applySubs(subs, nodeEdit);
				break;
			}
			case 'handle': {
				if (!nodeEdit) {
					break;
				}
				const subs = nodeEdit.subs.map((s, si) => ({
					...s,
					anchors: s.anchors.map((a, ai) =>
						si === d.sub && ai === d.idx ? { ...a, [d.which]: { x: pt.x, y: pt.y } } : a),
				}));
				applySubs(subs, nodeEdit);
				break;
			}
			case 'penHandle': {
				if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) > px(3)) {
					d.moved = true;
				}
				setPenDraft((cur) => {
					if (!cur) {
						return cur;
					}
					const anchors = cur.anchors.map((a, i) => (i === cur.anchors.length - 1
						? { ...a, out: { x: pt.x, y: pt.y }, in: { x: 2 * a.x - pt.x, y: 2 * a.y - pt.y } }
						: a));
					return { ...cur, anchors };
				});
				break;
			}
		}
	};

	const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
		pointers.current.delete(e.pointerId);
		const d = drag.current;
		drag.current = null;
		if (!d) {
			return;
		}
		switch (d.kind) {
			case 'move': {
				if (d.moved) {
					commit(live.current);
				}
				break;
			}
			case 'scale':
			case 'rotate':
			case 'anchor':
			case 'handle': {
				commit(live.current);
				break;
			}
			case 'draw': {
				const pt = toWorld(e.clientX, e.clientY);
				const shape = makeDrawShape(d.shape, d.start, pt, defaults);
				const box = shapeBox(shape);
				if (box.w > px(3) || box.h > px(3)) {
					const withId = { ...shape, id: freshId(d.shape) };
					commit([...live.current, withId]);
					setSelId(withId.id);
				}
				setPreview(null);
				break;
			}
			case 'pencil': {
				const fitted = fitPencil(d.pts, px(2.5));
				if (fitted && fitted.anchors.length >= 2) {
					const shape: Shape = {
						id: freshId('path'), type: 'path', d: serializePath([fitted]),
						fill: 'none', stroke: defaults.stroke, strokeWidth: defaults.strokeWidth,
						linecap: defaults.linecap, linejoin: defaults.linejoin,
						...(defaults.opacity !== 1 ? { opacity: defaults.opacity } : null),
					};
					commit([...live.current, shape]);
					setSelId(shape.id);
				}
				setPencilTrace(null);
				break;
			}
			case 'penHandle': {
				if (!d.moved) {
					// a tap places a corner anchor, no handles
					setPenDraft((cur) => (cur ? {
						...cur,
						anchors: cur.anchors.map((a, i) => (i === cur.anchors.length - 1
							? { x: a.x, y: a.y } : a)),
					} : cur));
				}
				break;
			}
			default:
				break;
		}
	};

	// a cancelled pointer (palm rejection, OS gesture steal) must not commit a
	// half-finished drag, roll it back instead
	const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
		pointers.current.delete(e.pointerId);
		abortDrag();
	};

	// ---- keyboard ----

	const keyRef = useRef({ undo, redo, removeNode, finishPen, penDraft, nodeEdit, selId, armOrigin });
	keyRef.current = { undo, redo, removeNode, finishPen, penDraft, nodeEdit, selId, armOrigin };
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const k = keyRef.current;
			const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
			if (typing) {
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault();
				if (e.shiftKey) {
					k.redo();
				} else {
					k.undo();
				}
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault();
				k.redo();
			} else if (e.key === 'Enter' && k.penDraft) {
				k.finishPen(false);
			} else if (e.key === 'Escape') {
				if (k.armOrigin) {
					setArmOrigin(false);
				} else if (k.penDraft) {
					setPenDraft(null);
				} else if (k.nodeEdit) {
					setNodeEdit(null);
				} else {
					setSelId(null);
				}
			} else if ((e.key === 'Delete' || e.key === 'Backspace')) {
				if (k.nodeEdit?.sel) {
					k.removeNode();
				} else if (k.selId) {
					commitRef.current(liveRef.current().filter((s) => s.id !== k.selId));
					setSelId(null);
					setNodeEdit(null);
				}
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);
	const commitRef = useRef(commit);
	commitRef.current = commit;
	const liveRef = useRef(() => live.current);

	// ---- style edits (selected shape, or the defaults for new shapes) ----

	const styleOf = <K extends keyof StyleDefaults & keyof Shape,>(key: K): StyleDefaults[K] =>
		(sel && sel[key] !== undefined ? sel[key] : defaults[key]) as StyleDefaults[K];

	const setStyle = (patch: Partial<StyleDefaults>) => {
		if (sel) {
			patchShape(sel.id, patch as Partial<Shape>);
		}
		setDefaults((cur) => ({ ...cur, ...patch }));
	};

	// ---- layers ----

	const moveLayer = (id: string, dir: -1 | 1) => {
		// display list is topmost-first; render order is the array: up in the
		// panel means later in the array
		const at = live.current.findIndex((s) => s.id === id);
		const to = at + dir;
		if (at === -1 || to < 0 || to >= live.current.length) {
			return;
		}
		const next = [...live.current];
		[next[at], next[to]] = [next[to], next[at]];
		commit(next);
	};

	/** Rename a layer (= the shape's id). False when the name was rejected. */
	const renameLayer = (id: string, name: string): boolean => {
		const trimmed = name.trim();
		if (trimmed === id) {
			return true;
		}
		if (!trimmed || live.current.some((s) => s.id === trimmed)) {
			return false;
		}
		commit(live.current.map((s) => (s.id === id ? { ...s, id: trimmed } : s)));
		if (selId === id) {
			setSelId(trimmed);
		}
		if (nodeEdit?.shapeId === id) {
			setNodeEdit({ ...nodeEdit, shapeId: trimmed });
		}
		return true;
	};

	const deleteLayer = (id: string) => {
		commit(live.current.filter((s) => s.id !== id));
		if (selId === id) {
			setSelId(null);
		}
		if (nodeEdit?.shapeId === id) {
			setNodeEdit(null);
		}
	};

	// ---- save ----

	const save = async () => {
		const fields = {
			pose: doc.pose,
			label: (meta.seed ? `${label.trim() || 'v1'} refit` : label.trim()) || 'untitled figurehead',
			viewBox: doc.viewBox,
			shapes: live.current.map(cleanShape),
		};
		// a seed is carved, saving carves a fresh draft copy instead of a PUT
		const saved = await h.saveDesign(meta.seed ? null : docId, fields);
		if (saved) {
			setDocId(saved.id);
			setMeta({ published: saved.published, seed: saved.seed });
			setLabel(saved.label);
			setSavedAt({ shapes: live.current, label: saved.label });
		}
	};

	const leave = () => {
		if (dirty) {
			h.askConfirm('shop-leave', onClose);
		} else {
			onClose();
		}
	};

	// ---- render ----

	const onion = onionId ? h.designs.find((d) => d.id === onionId) : null;
	const selBox = sel ? shapeBox(sel) : null;
	const pad = px(6);
	const interactive = tool === 'select' || tool === 'nodes';

	const handleSpecs = selBox ? [
		{ hx: -1, hy: -1 }, { hx: 0, hy: -1 }, { hx: 1, hy: -1 },
		{ hx: -1, hy: 0 }, { hx: 1, hy: 0 },
		{ hx: -1, hy: 1 }, { hx: 0, hy: 1 }, { hx: 1, hy: 1 },
	].map(({ hx, hy }) => ({
		hx, hy,
		x: selBox.x - pad + ((hx + 1) / 2) * (selBox.w + pad * 2),
		y: selBox.y - pad + ((hy + 1) / 2) * (selBox.h + pad * 2),
	})) : [];

	const penPreviewD = penDraft ? serializePath([penDraft]) : '';

	return (
		<div className="shop-editor">
			<div className="shop-topbar" style={{ animation: 'fadeUp .5s ease both' }}>
				<button type="button" className="pill pill--quiet" onClick={leave}>
					{h.confirmKey === 'shop-leave' ? '← toss the unsaved carving?' : '← the shelf'}
				</button>
				<input type="text" className="input input--display" aria-label="design label" value={label}
					style={{ width: 'auto', flex: '1 1 140px', minWidth: 120, maxWidth: 280, padding: '8px 12px', fontSize: 17 }}
					onChange={(e) => setLabel(e.target.value)} />
				<span className="shop-dirty" style={{ color: dirty ? 'var(--gold)' : 'var(--periwinkle-deep)' }}>
					{dirty ? '◍ unsaved' : '○ saved'}
				</span>
				<div className="row-actions" style={{ marginLeft: 'auto' }}>
					<button type="button" className="pill pill--arrow" title="undo" disabled={histAt === 0} onClick={undo}>↺</button>
					<button type="button" className="pill pill--arrow" title="redo" disabled={histAt === hist.length - 1} onClick={redo}>↻</button>
					<button type="button" className="pill pill--arrow" title="zoom out" onClick={() => zoomCenter(1 / 1.3)}>−</button>
					<button type="button" className="pill pill--arrow" title="zoom in" onClick={() => zoomCenter(1.3)}>+</button>
					<button type="button" className="pill pill--quiet" onClick={fitView}>fit</button>
					<button type="button" className="btn btn--gold" style={{ padding: '10px 16px', fontSize: 12.5 }} onClick={() => void save()}>
						{meta.seed ? 'save a draft copy' : 'save'}
					</button>
				</div>
			</div>

			{meta.seed ? (
				<div className="shop-banner shop-banner--seed">
					◆ v1 is carved; the seed itself can't change. saving carves a fresh draft copy onto the shelf.
				</div>
			) : meta.published && (
				<div className="shop-banner">
					⚠ this design is on the bow, it's the live {doc.pose} cat. edits here go out with the next hoist, no publish needed.
				</div>
			)}

			<div className="shop-body">
				<div className="shop-rail" role="toolbar" aria-label="tools">
					{TOOLS.map((t) => (
						<button key={t.id} type="button" className="shop-tool" aria-pressed={tool === t.id} title={t.label}
							onClick={() => {
								setTool(t.id);
								setPenDraft(null);
								setArmOrigin(false);
								if (t.id !== 'nodes') {
									setNodeEdit(null);
								}
							}}>
							<span aria-hidden="true">{t.glyph}</span>
							<span className="shop-tool__name">{t.label}</span>
						</button>
					))}
					{penDraft && (
						<button type="button" className="shop-tool shop-tool--verb" onClick={() => finishPen(false)} title="finish the open path (Enter)">
							<span aria-hidden="true">✓</span>
							<span className="shop-tool__name">finish</span>
						</button>
					)}
					{nodeEdit?.sel && (
						<button type="button" className="shop-tool shop-tool--verb" onClick={removeNode} title="remove the selected node (Delete)">
							<span aria-hidden="true">✕</span>
							<span className="shop-tool__name">node</span>
						</button>
					)}
				</div>

				<div ref={wrapRef} className="shop-canvas-wrap">
					<svg ref={svgRef} className={`shop-canvas${tool === 'select' ? ' shop-canvas--select' : ''}`}
						role="application" aria-label="design canvas"
						onPointerDown={onPointerDown} onPointerMove={onPointerMove}
						onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
						<g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
							<rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="rgba(150,160,220,.05)"
								stroke="var(--border-chip)" strokeWidth={px(1)} strokeDasharray={`${px(5)} ${px(4)}`} />

							{onion && onion.id !== docId && (
								<g className="shop-onion" opacity={.28} style={{ pointerEvents: 'none' }}>
									{onion.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
								</g>
							)}

							{shapes.map((s) => (
								<g key={s.id} data-shape={s.id}
									onPointerDown={interactive ? () => { hitId.current = s.id; } : undefined}>
									<ShapeNode s={s} />
									{interactive && (
										<ShapeNode s={s} override={{
											fill: s.fill === 'none' || s.type === 'line' ? 'none' : 'transparent',
											stroke: 'transparent',
											strokeWidth: Math.max(s.strokeWidth ?? 1, px(12)),
											opacity: 1,
											pointerEvents: 'visiblePainted',
											style: { cursor: tool === 'select' ? 'move' : 'crosshair' },
										}} />
									)}
								</g>
							))}

							{preview && <ShapeNode s={preview} override={{ opacity: .7 }} />}
							{pencilTrace && pencilTrace.length > 1 && (
								<polyline points={pencilTrace.map((p) => `${p.x},${p.y}`).join(' ')}
									fill="none" stroke="var(--gold)" strokeWidth={px(1.4)} opacity={.8} />
							)}

							{/* pen draft: the path so far, its anchors, and the closing target */}
							{penDraft && (
								<g className="shop-pen">
									<path d={penPreviewD} fill="none" stroke="var(--gold)" strokeWidth={px(1.4)} strokeDasharray={`${px(4)} ${px(3)}`} />
									{penDraft.anchors.map((a, i) => (
										<circle key={i} cx={a.x} cy={a.y} r={i === 0 ? px(5) : px(3.5)}
											fill={i === 0 ? 'rgba(240,217,168,.35)' : 'var(--periwinkle)'}
											stroke="var(--gold)" strokeWidth={px(1)} />
									))}
								</g>
							)}

							{/* select-tool overlay: bbox, scale handles, rotate handle */}
							{tool === 'select' && sel && selBox && (
								<g className="shop-selbox">
									<rect x={selBox.x - pad} y={selBox.y - pad} width={selBox.w + pad * 2} height={selBox.h + pad * 2}
										fill="none" stroke="var(--periwinkle)" strokeWidth={px(1)} strokeDasharray={`${px(4)} ${px(3)}`} />
									<line x1={selBox.x + selBox.w / 2} y1={selBox.y - pad} x2={selBox.x + selBox.w / 2} y2={selBox.y - pad - px(22)}
										stroke="var(--periwinkle)" strokeWidth={px(1)} />
									<circle className="shop-rotate" cx={selBox.x + selBox.w / 2} cy={selBox.y - pad - px(26)} r={px(6)}
										fill="var(--card)" stroke="var(--gold)" strokeWidth={px(1.2)} style={{ cursor: 'grab' }}
										onPointerDown={(e) => {
											overlayHit.current = {
												kind: 'rotate', id: sel.id, orig: sel,
												center: { x: selBox.x + selBox.w / 2, y: selBox.y + selBox.h / 2 },
												start: toWorld(e.clientX, e.clientY),
											};
										}} />
									{handleSpecs.map((spec) => (
										<rect key={`${spec.hx},${spec.hy}`} className="shop-handle"
											x={spec.x - px(11)} y={spec.y - px(11)} width={px(22)} height={px(22)}
											fill="transparent" stroke="none" style={{ cursor: 'pointer' }}
											onPointerDown={() => {
												const fix = {
													x: spec.hx ? selBox.x - pad + ((-spec.hx + 1) / 2) * (selBox.w + pad * 2) : selBox.x + selBox.w / 2,
													y: spec.hy ? selBox.y - pad + ((-spec.hy + 1) / 2) * (selBox.h + pad * 2) : selBox.y + selBox.h / 2,
												};
												overlayHit.current = {
													kind: 'scale', id: sel.id, orig: sel, fix,
													grab: { x: spec.x, y: spec.y }, hx: spec.hx, hy: spec.hy,
												};
											}} />
									))}
									{handleSpecs.map((spec) => (
										<rect key={`v${spec.hx},${spec.hy}`} x={spec.x - px(3.5)} y={spec.y - px(3.5)} width={px(7)} height={px(7)}
											fill="var(--card)" stroke="var(--periwinkle)" strokeWidth={px(1)} pointerEvents="none" />
									))}
								</g>
							)}

							{/* node-tool overlay: segments (tap to add), anchors, handles */}
							{tool === 'nodes' && nodeEdit && (
								<g className="shop-nodes">
									{nodeEdit.subs.map((sub, si) => {
										const n = sub.anchors.length;
										const segs = sub.closed ? n : n - 1;
										return Array.from({ length: segs }, (_, i) => {
											const a = sub.anchors[i];
											const b = sub.anchors[(i + 1) % n];
											const [p0, p1, p2, p3] = segmentCtrl(a, b);
											return (
												<path key={`${si}-${i}`} className="shop-seg"
													d={`M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`}
													fill="none" stroke="transparent" strokeWidth={px(14)} pointerEvents="stroke"
													style={{ cursor: 'copy' }}
													onPointerDown={(e) => {
														// tap a segment to grow an anchor there, ready to drag
														const t = nearestT(a, b, toWorld(e.clientX, e.clientY));
														const subs = nodeEdit.subs.map((x, xi) => (xi === si ? splitSegment(x, i, t) : x));
														applySubs(subs, { ...nodeEdit, sel: { sub: si, idx: i + 1 } });
														overlayHit.current = {
															kind: 'anchor', sub: si, idx: i + 1,
															start: toWorld(e.clientX, e.clientY), orig: subs,
														};
													}} />
											);
										});
									})}
									{nodeEdit.subs.map((sub, si) => sub.anchors.map((a, ai) => {
										const selected = nodeEdit.sel?.sub === si && nodeEdit.sel?.idx === ai;
										return (
											<g key={`${si}-${ai}`}>
												{a.in && (
													<>
														<line x1={a.x} y1={a.y} x2={a.in.x} y2={a.in.y} stroke="var(--periwinkle-deep)" strokeWidth={px(.8)} />
														<circle className="shop-node-handle" cx={a.in.x} cy={a.in.y} r={px(8)} fill="transparent"
															style={{ cursor: 'pointer' }}
															onPointerDown={() => { overlayHit.current = { kind: 'handle', sub: si, idx: ai, which: 'in' }; }} />
														<circle cx={a.in.x} cy={a.in.y} r={px(2.4)} fill="var(--periwinkle-deep)" pointerEvents="none" />
													</>
												)}
												{a.out && (
													<>
														<line x1={a.x} y1={a.y} x2={a.out.x} y2={a.out.y} stroke="var(--periwinkle-deep)" strokeWidth={px(.8)} />
														<circle className="shop-node-handle" cx={a.out.x} cy={a.out.y} r={px(8)} fill="transparent"
															style={{ cursor: 'pointer' }}
															onPointerDown={() => { overlayHit.current = { kind: 'handle', sub: si, idx: ai, which: 'out' }; }} />
														<circle cx={a.out.x} cy={a.out.y} r={px(2.4)} fill="var(--periwinkle-deep)" pointerEvents="none" />
													</>
												)}
												<circle className="shop-node" data-node={`${si}-${ai}`} cx={a.x} cy={a.y} r={px(10)}
													fill="transparent" style={{ cursor: 'pointer' }}
													onPointerDown={(e) => {
														setNodeEdit({ ...nodeEdit, sel: { sub: si, idx: ai } });
														overlayHit.current = {
															kind: 'anchor', sub: si, idx: ai,
															start: toWorld(e.clientX, e.clientY), orig: nodeEdit.subs,
														};
													}} />
												<circle cx={a.x} cy={a.y} r={px(3.2)} pointerEvents="none"
													fill={selected ? 'var(--gold)' : 'var(--card)'}
													stroke={selected ? 'var(--gold)' : 'var(--periwinkle)'} strokeWidth={px(1.2)} />
											</g>
										);
									}))}
								</g>
							)}

							{/* the animation origin of the selected shape */}
							{sel?.origin && (
								<g className="shop-origin" pointerEvents="none">
									<line x1={sel.origin[0] - px(7)} y1={sel.origin[1]} x2={sel.origin[0] + px(7)} y2={sel.origin[1]} stroke="var(--gold)" strokeWidth={px(1)} />
									<line x1={sel.origin[0]} y1={sel.origin[1] - px(7)} x2={sel.origin[0]} y2={sel.origin[1] + px(7)} stroke="var(--gold)" strokeWidth={px(1)} />
									<circle cx={sel.origin[0]} cy={sel.origin[1]} r={px(3.5)} fill="none" stroke="var(--gold)" strokeWidth={px(1)} />
								</g>
							)}
						</g>
					</svg>
					{armOrigin && (
						<div className="shop-hint">tap the canvas to plant the origin for “{selId}”</div>
					)}
				</div>

				<aside className="shop-side">
					<div className="card card--alt shop-panel">
						<span className="card-kicker" style={{ fontSize: 10.5 }}>paint locker</span>

						<span className="field-label">fill</span>
						<div className="shop-swatches">
							{PALETTE.map((c) => (
								<button key={c} type="button" className="shop-swatch" style={{ background: c }} title={c}
									aria-pressed={styleOf('fill') === c} aria-label={`fill ${c}`}
									onClick={() => setStyle({ fill: c })} />
							))}
							<button type="button" className="shop-swatch shop-swatch--none" title="no fill"
								aria-pressed={styleOf('fill') === 'none'} aria-label="fill none"
								onClick={() => setStyle({ fill: 'none' })} />
							<input type="color" className="shop-swatch shop-swatch--free" aria-label="free fill color"
								value={/^#[0-9a-fA-F]{6}$/.test(styleOf('fill')) ? styleOf('fill') : '#232a4d'}
								onChange={(e) => setStyle({ fill: e.target.value })} />
						</div>

						<span className="field-label">stroke</span>
						<div className="shop-swatches">
							{PALETTE.map((c) => (
								<button key={c} type="button" className="shop-swatch" style={{ background: c }} title={c}
									aria-pressed={styleOf('stroke') === c} aria-label={`stroke ${c}`}
									onClick={() => setStyle({ stroke: c })} />
							))}
							<button type="button" className="shop-swatch shop-swatch--none" title="no stroke"
								aria-pressed={styleOf('stroke') === 'none'} aria-label="stroke none"
								onClick={() => setStyle({ stroke: 'none' })} />
							<input type="color" className="shop-swatch shop-swatch--free" aria-label="free stroke color"
								value={/^#[0-9a-fA-F]{6}$/.test(styleOf('stroke')) ? styleOf('stroke') : '#93a0e8'}
								onChange={(e) => setStyle({ stroke: e.target.value })} />
						</div>

						<label className="field-label" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
							<span>stroke width</span><span>{round2(styleOf('strokeWidth'))}</span>
							<input type="range" min={0.2} max={8} step={0.1} value={styleOf('strokeWidth')}
								style={{ width: '100%', accentColor: 'var(--gold)' }}
								onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })} />
						</label>
						<label className="field-label" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
							<span>opacity</span><span>{round2(styleOf('opacity'))}</span>
							<input type="range" min={0.05} max={1} step={0.05} value={styleOf('opacity')}
								style={{ width: '100%', accentColor: 'var(--gold)' }}
								onChange={(e) => setStyle({ opacity: Number(e.target.value) })} />
						</label>

						<span className="field-label">linecap · linejoin</span>
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
							{LINECAPS.map((c) => (
								<button key={c} type="button" className="pill pill--quiet" style={{ padding: '5px 10px', fontSize: 11 }}
									aria-pressed={styleOf('linecap') === c}
									onClick={() => setStyle({ linecap: c })}>{c}</button>
							))}
						</div>
						<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
							{LINEJOINS.map((c) => (
								<button key={c} type="button" className="pill pill--quiet" style={{ padding: '5px 10px', fontSize: 11 }}
									aria-pressed={styleOf('linejoin') === c}
									onClick={() => setStyle({ linejoin: c })}>{c}</button>
							))}
						</div>
					</div>

					<div className="card card--alt shop-panel">
						<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
							<span className="card-kicker" style={{ fontSize: 10.5 }}>layers</span>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>top first</span>
						</div>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
							{shapes.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
								<div key={s.id} data-layer={s.id} className={`shop-layer${selId === s.id ? ' shop-layer--sel' : ''}`}
									onClick={() => {
										setSelId(s.id);
										if (tool === 'nodes') {
											setNodeEdit(s.type === 'path' ? { shapeId: s.id, subs: parsePath(s.d ?? ''), sel: null } : null);
										}
									}}>
									<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--periwinkle-deep)', width: 14, flexShrink: 0 }}>
										{s.type === 'path' ? '∿' : s.type === 'ellipse' ? '◯' : s.type === 'rect' ? '▭' : '╱'}
									</span>
									<input type="text" className="input shop-layer__name" defaultValue={s.id} aria-label="layer name"
										onBlur={(e) => {
											// a rejected name must not linger in the box
											if (!renameLayer(s.id, e.target.value)) {
												e.target.value = s.id;
											}
										}}
										onKeyDown={(e) => {
											if (e.key === 'Enter') {
												e.currentTarget.blur();
											}
										}} />
									<select className="input shop-layer__role" aria-label="role" value={s.role ?? ''}
										title="role tag: drives the site's canonical animations"
										onClick={(e) => e.stopPropagation()}
										onChange={(e) => {
											const role = e.target.value as ShapeRole | '';
											patchShape(s.id, role
												? { role }
												: { role: undefined, origin: undefined });
										}}>
										{ROLES.map((r) => <option key={r} value={r}>{r || '–'}</option>)}
									</select>
									{s.role && (
										<button type="button" className="shop-mini" title="set the animation origin, then tap the canvas"
											aria-pressed={armOrigin && selId === s.id}
											onClick={(e) => {
												e.stopPropagation();
												setSelId(s.id);
												setArmOrigin((cur) => !(cur && selId === s.id));
											}}>⌖</button>
									)}
									<button type="button" className="shop-mini" title="raise" disabled={i === shapes.length - 1}
										onClick={(e) => { e.stopPropagation(); moveLayer(s.id, 1); }}>▲</button>
									<button type="button" className="shop-mini" title="lower" disabled={i === 0}
										onClick={(e) => { e.stopPropagation(); moveLayer(s.id, -1); }}>▼</button>
									<button type="button" className="shop-mini" title="delete this layer"
										onClick={(e) => { e.stopPropagation(); deleteLayer(s.id); }}>✕</button>
								</div>
							))}
							{shapes.length === 0 && (
								<span className="row-sub" style={{ fontStyle: 'italic', fontSize: 13 }}>a bare hull, draw something.</span>
							)}
						</div>
					</div>

					<div className="card card--alt shop-panel">
						<span className="card-kicker" style={{ fontSize: 10.5 }}>onion skin</span>
						<select className="input" aria-label="onion skin" value={onionId}
							onChange={(e) => setOnionId(e.target.value)}>
							<option value="">none</option>
							{h.designs.filter((d) => d.id !== docId).map((d) => (
								<option key={d.id} value={d.id}>{d.label} · {d.pose}</option>
							))}
						</select>
						<span className="footnote" style={{ fontSize: 10.5 }}>// ghost another version behind the canvas.</span>
					</div>
				</aside>
			</div>
		</div>
	);
}
