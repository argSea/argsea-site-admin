// The carving shop. One wide bench that IS the editor: the figurehead editor
// engine (ghost carving, node/pen/pencil tools, immutable-snapshot undo, real
// zoom/fit, layers) merged with the marginalia toolset, wearing the mock's new
// shell (catalog popover, floating tool palette, zoom cluster, markup drawer,
// bolt row). Editor-born carvings serialize their shape model into the raw svg
// wire with a metadata island so reopening restores editability; seeds and
// hand-pasted markup carry no island and are canvas-locked, never parsed.
import { useEffect, useRef, useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { CarvingCatalogEntry } from '../state/harbor';
import { CARVING_CATALOG } from '../state/harbor';
import type { Carving, Linecap, Linejoin, Shape } from '../lib/api';
import type { Pt, SubPath } from '../lib/shapes';
import {
	carvingSvg, fitPencil, nearestT, parsePath, parseViewBox, readCarvingModel,
	round2, rotateShape, scaleShape, segmentCtrl, serializePath, shapeBox, splitSegment,
	stripCarvingModel, svgInner, svgViewBox, translateShape,
} from '../lib/shapes';
import { ShapeNode } from '../components/ShapeEditor';
import CatPerch from '../components/CatPerch';
import './CarvingShop.css';

const CAT_QUIPS = ['supervising.', 'carve nothing without me.', 'approval pending. indefinitely.'];

// A fresh block off the bench: the mock's 40x40 starter, a ring and a mast,
// as an editable shape model rather than frozen markup.
const STARTER_VIEWBOX = '0 0 40 40';
const STARTER_SHAPES: Shape[] = [
	{ id: 'ring-1', type: 'ellipse', cx: 20, cy: 20, rx: 12, ry: 12, fill: 'none', stroke: '#93a0e8', strokeWidth: 1.5 },
	{ id: 'mast-1', type: 'line', x1: 20, y1: 8, x2: 20, y2: 3, stroke: '#f0d9a8', strokeWidth: 1.5 },
];

const TOOLS = [
	{ id: 'select', glyph: '⇱', title: 'select · move and shape the carving' },
	{ id: 'nodes',  glyph: '◇', title: 'nodes · bend the lines at their joints' },
	{ id: 'pen',    glyph: '✒', title: 'pen · lay a path point by point' },
	{ id: 'pencil', glyph: '✎', title: 'pencil · carve freehand' },
] as const;
type Tool = typeof TOOLS[number]['id'];

// the cat's own inks, one tap away; anything else through the free input
const PALETTE = ['#232a4d', '#93a0e8', '#f0d9a8', '#5f6ec4'];
const LINECAPS: Linecap[] = ['butt', 'round', 'square'];
const LINEJOINS: Linejoin[] = ['miter', 'round', 'bevel'];

// The loose SVG rules, in keeper voice, keyed by spot: bench hint copy rather
// than a validator (operator ruling: rules are loose, communicated not enforced).
const SPOT_HINTS: Record<string, string> = {
	'lighthouse-logo': 'keep the viewBox honest, it sits small in the nav.',
	boat: 'keep the viewBox, the hero animation rides the boat\'s own coordinates.',
	bottle: 'keep the viewBox, it bobs on the wave at a fixed size.',
	'tower-stub': 'keep the lamp anchor so the light engine can still attach to it.',
	paw: 'keep the viewBox small, it walks across a single journal row.',
	'wave-line': 'keep it tileable, the pattern repeats edge to edge.',
	'boat-wake': 'keep it tileable, the pattern trails the boat edge to edge.',
};

// Carvings are raw SVG by contract, so this is the one screen that renders
// markup instead of structured shapes. Neutralize <script the way the mock
// does; the keeper is the only one who ever types here.
function safeSvg(svg: string): string {
	return svg.replace(/<\s*script/gi, '&lt;script');
}

function Thumb({ svg }: { svg: string | null }) {
	if (!svg) {
		return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)' }}>△</span>;
	}
	return <span className="carving-thumb__art" dangerouslySetInnerHTML={{ __html: safeSvg(svg) }} />;
}

interface CatalogGroup { page: string; items: CarvingCatalogEntry[] }

function groupByPage(entries: CarvingCatalogEntry[]): CatalogGroup[] {
	const groups: CatalogGroup[] = [];
	for (const entry of entries) {
		let g = groups.find((x) => x.page === entry.page);
		if (!g) {
			g = { page: entry.page, items: [] };
			groups.push(g);
		}
		g.items.push(entry);
	}
	return groups;
}

const CATALOG_GROUPS = groupByPage(CARVING_CATALOG);
const SPOTS = CARVING_CATALOG.filter((entry) => entry.spot);

// ---- the editor engine ----

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
	| { kind: 'pencil'; pts: Pt[] }
	| { kind: 'anchor'; sub: number; idx: number; start: Pt; orig: SubPath[] }
	| { kind: 'handle'; sub: number; idx: number; which: 'in' | 'out' }
	| { kind: 'penHandle'; start: Pt; moved: boolean };

const clampScale = (s: number): number => Math.min(60, Math.max(0.15, s));

type Mode = 'note' | 'locked' | 'model' | 'raw';

// What the bench loads. A note is a catalog-only entry (no carving behind it);
// a fresh block is a new editable model; a carving loads locked (builtin),
// model (has the island), or raw (a seed / hand-pasted markup, no island).
type Loaded =
	| { kind: 'note'; entry: CarvingCatalogEntry }
	| { kind: 'carving'; carving: Carving }
	| { kind: 'fresh'; nonce: number; name: string; viewBox: string; shapes: Shape[]; ghostId: string | null };

interface EngineInit {
	mode:     Mode;
	savedId:  string | null;
	name:     string;
	viewBox:  string;
	shapes:   Shape[];
	rawSvg:   string;
	ghostId:  string | null;
}

function initEngine(loaded: Loaded): EngineInit {
	if (loaded.kind === 'note') {
		return { mode: 'note', savedId: null, name: loaded.entry.name, viewBox: STARTER_VIEWBOX, shapes: [], rawSvg: '', ghostId: null };
	}
	if (loaded.kind === 'fresh') {
		return { mode: 'model', savedId: null, name: loaded.name, viewBox: loaded.viewBox, shapes: loaded.shapes, rawSvg: '', ghostId: loaded.ghostId };
	}
	const c = loaded.carving;
	if (c.builtin) {
		return { mode: 'locked', savedId: c.id, name: c.name, viewBox: svgViewBox(c.svg), shapes: [], rawSvg: c.svg, ghostId: null };
	}
	const model = readCarvingModel(c.svg);
	if (model) {
		return { mode: 'model', savedId: c.id, name: c.name, viewBox: model.viewBox, shapes: model.shapes, rawSvg: '', ghostId: null };
	}
	return { mode: 'raw', savedId: c.id, name: c.name, viewBox: svgViewBox(c.svg), shapes: [], rawSvg: c.svg, ghostId: null };
}

interface BenchProps {
	loaded:        Loaded;
	assignSpot:    string;
	setAssignSpot: (s: string) => void;
	catOpen:       boolean;
	setCatOpen:    (b: boolean) => void;
	benchTop:      'navy' | 'white';
	setBenchTop:   (t: 'navy' | 'white') => void;
	palX:          number;
	palY:          number;
	palOpen:       boolean;
	setPal:        (p: { x?: number; y?: number; open?: boolean }) => void;
	onSelect:      (loaded: Loaded) => void;
	onFresh:       () => void;
}

// The bench is keyed by its loaded carving, so switching the catalog picker
// remounts a clean engine; the shell prefs (palette, bench top, popover) live
// in the parent and survive the remount.
function Bench(props: BenchProps) {
	const h = useHarbor();
	const init = useRef<EngineInit>(initEngine(props.loaded)).current;

	const [mode, setMode] = useState<Mode>(init.mode);
	const [savedId, setSavedId] = useState<string | null>(init.savedId);
	const [shapes, setShapesRaw] = useState<Shape[]>(init.shapes);
	const [hist, setHist] = useState<Shape[][]>([init.shapes]);
	const [histAt, setHistAt] = useState(0);
	const [rawSvg, setRawSvg] = useState(init.rawSvg);
	// the last-saved svg string, the one dirtiness is measured against; a model
	// block and a raw block share the same yardstick, so dropping the island by
	// hand reads dirty and undoing back to the saved shapes reads clean
	const [savedSvg, setSavedSvg] = useState(init.mode === 'model' ? carvingSvg(init.viewBox, init.shapes) : init.rawSvg);
	const [tool, setTool] = useState<Tool>('select');
	const [selId, setSelId] = useState<string | null>(null);
	const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
	const [nodeEdit, setNodeEdit] = useState<NodeEditState | null>(null);
	const [penDraft, setPenDraft] = useState<SubPath | null>(null);
	const [pencilTrace, setPencilTrace] = useState<Pt[] | null>(null);
	const [defaults, setDefaults] = useState<StyleDefaults>({
		fill: 'none', stroke: '#93a0e8', strokeWidth: 1.6, opacity: 1, linecap: 'round', linejoin: 'round',
	});
	const [ghostId, setGhostId] = useState<string | null>(init.ghostId);
	const ghostSvg = ghostId ? h.carvings.find((c) => c.id === ghostId)?.svg ?? null : null;
	const [drawerOpen, setDrawerOpen] = useState(props.loaded.kind === 'fresh');
	const [foldout, setFoldout] = useState<'inks' | 'layers' | 'ghost' | null>(null);
	const [bolted, setBolted] = useState(false);
	const boltT = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(boltT.current), []);

	const { name } = init;
	const vb = parseViewBox(init.viewBox);

	const svgRef = useRef<SVGSVGElement>(null);
	const wrapRef = useRef<HTMLDivElement>(null);
	const drag = useRef<Drag | null>(null);
	const pointers = useRef(new Map<number, Pt>());
	const hitId = useRef<string | null>(null);
	const overlayHit = useRef<Drag | null>(null);
	const live = useRef<Shape[]>(init.shapes);
	const fitScale = useRef(1);

	const px = (n: number) => n / view.scale;

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

	const isModel = mode === 'model';
	const editableMarkup = mode === 'model' || mode === 'raw';
	const currentSvg = isModel ? carvingSvg(init.viewBox, shapes) : rawSvg;
	const dirty = editableMarkup && currentSvg !== savedSvg;
	const neverSaved = savedId === null;
	const isBlank = isModel ? shapes.length === 0 : !rawSvg.trim();
	const unsaved = dirty || (neverSaved && editableMarkup);
	const canSave = editableMarkup && (dirty || neverSaved);
	const canBolt = mode !== 'note' && !neverSaved && !dirty && !isBlank;

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
		const scale = clampScale(Math.min((w - 96) / vb.w, (height - 128) / vb.h));
		fitScale.current = scale;
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
				id: freshId('carve'), type: 'path',
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
			setPenDraft((cur) => (cur && cur.anchors.length > 1
				? { ...cur, anchors: cur.anchors.slice(0, -1) }
				: null));
		}
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
			overlayHit.current = null;
			hitId.current = null;
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
			case 'pencil': {
				const fitted = fitPencil(d.pts, px(2.5));
				if (fitted && fitted.anchors.length >= 2) {
					const shape: Shape = {
						id: freshId('carve'), type: 'path', d: serializePath([fitted]),
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

	const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
		pointers.current.delete(e.pointerId);
		abortDrag();
	};

	// ---- keyboard ----

	const keyRef = useRef({ undo, redo, removeNode, finishPen, penDraft, nodeEdit, selId, isModel });
	keyRef.current = { undo, redo, removeNode, finishPen, penDraft, nodeEdit, selId, isModel };
	const commitRef = useRef(commit);
	commitRef.current = commit;
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const k = keyRef.current;
			const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
			if (typing || !k.isModel) {
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
				if (k.penDraft) {
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
					commitRef.current(live.current.filter((s) => s.id !== k.selId));
					setSelId(null);
					setNodeEdit(null);
				}
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, []);

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
		const at = live.current.findIndex((s) => s.id === id);
		const to = at + dir;
		if (at === -1 || to < 0 || to >= live.current.length) {
			return;
		}
		const next = [...live.current];
		[next[at], next[to]] = [next[to], next[at]];
		commit(next);
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

	// ---- save / bolt / copy ----

	const save = async () => {
		if (!canSave) {
			return;
		}
		const svg = isModel ? carvingSvg(init.viewBox, live.current) : rawSvg;
		const saved = await h.saveCarving(savedId, { name, svg });
		if (saved) {
			setSavedId(saved.id);
			setSavedSvg(svg);
		}
	};

	// hand-editing the markup drops the model island and steps the tools back:
	// what the keeper typed is the carving now, raw and unparsed. the machine-
	// written island goes with the switch, or a stale model would resurrect the
	// pre-edit shapes on reopen and silently revert the live hand edit.
	const editMarkup = (value: string) => {
		if (mode === 'model') {
			setMode('raw');
		}
		setRawSvg(stripCarvingModel(value));
	};

	// leaving the bench with unsaved edits: a two-click confirm, same vocabulary
	// as the doodle desk, so a stray catalog pick or fresh block cannot toss the
	// draft without a second, deliberate click.
	const guardedLeave = (go: () => void) => {
		if (dirty) {
			h.askConfirm('bench-leave', go);
			return;
		}
		go();
	};

	const bolt = async () => {
		if (!canBolt || !savedId) {
			return;
		}
		const carving = h.carvings.find((c) => c.id === savedId);
		if (!carving) {
			return;
		}
		await h.boltCarving(carving, props.assignSpot);
		setBolted(true);
		window.clearTimeout(boltT.current);
		boltT.current = window.setTimeout(() => setBolted(false), 2600);
	};

	const copyToFresh = async () => {
		const saved = await h.saveCarving(null, { name: `${name} copy`, svg: rawSvg });
		if (saved) {
			props.onSelect({ kind: 'carving', carving: saved });
		}
	};

	// ---- catalog popover data ----

	const boltedTo = (spotId: string): Carving | undefined => h.carvings.find((c) => c.boltedTo.includes(spotId));
	const onTheBench = h.carvings.filter((c) => !c.boltedTo.length);
	const customCount = h.carvings.filter((c) => !c.builtin).length;

	const pickSpot = (entry: CarvingCatalogEntry) => {
		const carving = boltedTo(entry.id);
		if (!carving) {
			return;
		}
		props.setAssignSpot(entry.id);
		props.onSelect({ kind: 'carving', carving });
	};

	// ---- render ----

	const selBox = sel ? shapeBox(sel) : null;
	const pad = px(6);
	const interactive = isModel && (tool === 'select' || tool === 'nodes');
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
	const zoomPct = Math.round((view.scale / (fitScale.current || 1)) * 100);
	const spotHint = SPOT_HINTS[props.assignSpot] ?? '';

	const pickerSvg = mode === 'note' ? null : currentSvg;
	const pickerWhere = mode === 'note'
		? (props.loaded.kind === 'note' ? props.loaded.entry.where : '')
		: savedId && h.carvings.find((c) => c.id === savedId)?.boltedTo.length
			? SPOTS.find((s) => s.id === h.carvings.find((c) => c.id === savedId)!.boltedTo[0])?.where ?? 'on the bench'
			: 'fresh off the bench, unassigned';

	return (
		<>
			<div className={`carving-bench carving-bench--${props.benchTop}`}>
				{/* top bar: catalog picker + fresh block */}
				<div className="carving-topbar">
					<div className="carving-picker-wrap">
						<button type="button" className="carving-picker" title="the catalog · every carving on the site"
							aria-expanded={props.catOpen} onClick={() => props.setCatOpen(!props.catOpen)}>
							<span className="carving-picker__thumb"><Thumb svg={pickerSvg} /></span>
							<span className="carving-picker__text">
								<span className="carving-picker__name">{name}</span>
								<span className="carving-picker__where">{pickerWhere}</span>
							</span>
							<span className="carving-picker__chevron">{props.catOpen ? '▴' : '▾'}</span>
						</button>
						{props.catOpen && (
							<div className="carving-catalog" role="menu">
								<div className="carving-catalog__head">
									<span className="carving-catalog__kicker">the catalog</span>
									{h.confirmKey === 'bench-leave'
										? <span className="carving-catalog__confirm">unsaved carving. pick again to toss it.</span>
										: <span className="carving-catalog__count">{CARVING_CATALOG.length} on the books · {customCount} fresh</span>}
								</div>
								{CATALOG_GROUPS.map((group) => (
									<div key={group.page} className="carving-catalog__group">
										<span className="carving-catalog__page">{group.page}</span>
										<div className="carving-tiles">
											{group.items.map((entry) => {
												const carving = entry.spot ? boltedTo(entry.id) : undefined;
												const isSel = entry.spot
													? Boolean(carving && savedId === carving.id)
													: mode === 'note' && props.loaded.kind === 'note' && props.loaded.entry.id === entry.id;
												return (
													<button key={entry.id} type="button" title={entry.where}
														className={`carving-tile${isSel ? ' carving-tile--sel' : ''}`}
														onClick={() => guardedLeave(() => (entry.spot ? pickSpot(entry) : props.onSelect({ kind: 'note', entry })))}>
														<span className="carving-tile__thumb"><Thumb svg={entry.spot ? (carving?.svg ?? null) : null} /></span>
														<span className="carving-tile__name">{entry.name}</span>
													</button>
												);
											})}
										</div>
									</div>
								))}
								{onTheBench.length > 0 && (
									<div className="carving-catalog__group">
										<span className="carving-catalog__page">the bench</span>
										<div className="carving-tiles">
											{onTheBench.map((carving) => (
												<button key={carving.id} type="button" title="unassigned"
													className={`carving-tile${savedId === carving.id ? ' carving-tile--sel' : ''}`}
													onClick={() => guardedLeave(() => props.onSelect({ kind: 'carving', carving }))}>
													<span className="carving-tile__thumb"><Thumb svg={carving.svg || null} /></span>
													<span className="carving-tile__name">{carving.name}</span>
												</button>
											))}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
					<button type="button" className="carving-fresh" onClick={() => guardedLeave(props.onFresh)}>
						{h.confirmKey === 'bench-leave' ? 'toss the unsaved carving?' : '+ a fresh block'}
					</button>
				</div>

				{/* floating tool palette: drag by the grip, collapse by the chevron */}
				<div className="carving-pal" style={{ left: props.palX, top: props.palY }}>
					<div className="carving-pal__head">
						<button type="button" className="carving-pal__grip" title="drag the tool tray" aria-label="drag the tool tray"
							onPointerDown={(e) => {
								e.preventDefault();
								const sx = e.clientX;
								const sy = e.clientY;
								const ox = props.palX;
								const oy = props.palY;
								const move = (m: PointerEvent) => {
									props.setPal({
										x: Math.max(4, Math.min(ox + m.clientX - sx, window.innerWidth - 120)),
										y: Math.max(4, Math.min(oy + m.clientY - sy, window.innerHeight - 80)),
									});
								};
								const up = () => {
									window.removeEventListener('pointermove', move);
									window.removeEventListener('pointerup', up);
								};
								window.addEventListener('pointermove', move);
								window.addEventListener('pointerup', up);
							}}>⠿</button>
						<button type="button" className="carving-pal__toggle" title="tuck the tools away"
							onClick={() => props.setPal({ open: !props.palOpen })}>{props.palOpen ? '▴' : '▾'}</button>
					</div>
					{props.palOpen && (
						<div className="carving-pal__body">
							<div className="carving-tools">
								{TOOLS.map((t) => (
									<button key={t.id} type="button" className="carving-tool" title={t.title}
										aria-pressed={tool === t.id} disabled={!isModel}
										onClick={() => {
											setTool(t.id);
											setPenDraft(null);
											if (t.id !== 'nodes') {
												setNodeEdit(null);
											}
										}}>{t.glyph}</button>
								))}
								{penDraft && (
									<button type="button" className="carving-tool carving-tool--verb" title="finish the open path (Enter)"
										onClick={() => finishPen(false)}>✓</button>
								)}
								{nodeEdit?.sel && (
									<button type="button" className="carving-tool carving-tool--verb" title="remove the selected node (Delete)"
										onClick={removeNode}>✕</button>
								)}
							</div>

							<div className="carving-pal__row">
								<button type="button" className="carving-mini" title="undo" disabled={!isModel || histAt === 0} onClick={undo}>↺</button>
								<button type="button" className="carving-mini" title="redo" disabled={!isModel || histAt === hist.length - 1} onClick={redo}>↻</button>
								{editableMarkup && (
									<>
										<span className="carving-dirty" style={{ color: unsaved ? 'var(--gold)' : 'var(--periwinkle-deep)' }}>
											{unsaved ? '◍ unsaved' : '○ saved'}
										</span>
										<button type="button" className="carving-save" disabled={!canSave} onClick={() => void save()}>save</button>
									</>
								)}
							</div>

							{/* ink fold-out (ruling 3): fills, strokes, width, opacity, caps, joins */}
							<button type="button" className="carving-fold" aria-expanded={foldout === 'inks'} disabled={!isModel}
								onClick={() => setFoldout((f) => (f === 'inks' ? null : 'inks'))}>
								inks <span>{foldout === 'inks' ? '▴' : '▾'}</span>
							</button>
							{foldout === 'inks' && isModel && (
								<div className="carving-inks">
									<span className="field-label">fill</span>
									<div className="carving-wells">
										{PALETTE.map((c) => (
											<button key={c} type="button" className="carving-well" style={{ background: c }} title={c}
												aria-pressed={styleOf('fill') === c} aria-label={`fill ${c}`} onClick={() => setStyle({ fill: c })} />
										))}
										<button type="button" className="carving-well carving-well--dry" title="no fill"
											aria-pressed={styleOf('fill') === 'none'} aria-label="fill none" onClick={() => setStyle({ fill: 'none' })} />
										<input type="color" className="carving-well carving-well--free" aria-label="free fill color"
											value={/^#[0-9a-fA-F]{6}$/.test(styleOf('fill')) ? styleOf('fill') : '#232a4d'}
											onChange={(e) => setStyle({ fill: e.target.value })} />
									</div>
									<span className="field-label">stroke</span>
									<div className="carving-wells">
										{PALETTE.map((c) => (
											<button key={c} type="button" className="carving-well" style={{ background: c }} title={c}
												aria-pressed={styleOf('stroke') === c} aria-label={`stroke ${c}`} onClick={() => setStyle({ stroke: c })} />
										))}
										<button type="button" className="carving-well carving-well--dry" title="no stroke"
											aria-pressed={styleOf('stroke') === 'none'} aria-label="stroke none" onClick={() => setStyle({ stroke: 'none' })} />
										<input type="color" className="carving-well carving-well--free" aria-label="free stroke color"
											value={/^#[0-9a-fA-F]{6}$/.test(styleOf('stroke')) ? styleOf('stroke') : '#93a0e8'}
											onChange={(e) => setStyle({ stroke: e.target.value })} />
									</div>
									<label className="field-label carving-slider">
										<span>stroke width</span><span>{round2(styleOf('strokeWidth'))}</span>
										<input type="range" min={0.2} max={8} step={0.1} value={styleOf('strokeWidth')}
											onChange={(e) => setStyle({ strokeWidth: Number(e.target.value) })} />
									</label>
									<label className="field-label carving-slider">
										<span>opacity</span><span>{round2(styleOf('opacity'))}</span>
										<input type="range" min={0.05} max={1} step={0.05} value={styleOf('opacity')}
											onChange={(e) => setStyle({ opacity: Number(e.target.value) })} />
									</label>
									<span className="field-label">cap · join</span>
									<div className="carving-pills">
										{LINECAPS.map((c) => (
											<button key={c} type="button" className="pill pill--quiet carving-pill"
												aria-pressed={styleOf('linecap') === c} onClick={() => setStyle({ linecap: c })}>{c}</button>
										))}
									</div>
									<div className="carving-pills">
										{LINEJOINS.map((c) => (
											<button key={c} type="button" className="pill pill--quiet carving-pill"
												aria-pressed={styleOf('linejoin') === c} onClick={() => setStyle({ linejoin: c })}>{c}</button>
										))}
									</div>
								</div>
							)}

							<button type="button" className="carving-fold" aria-expanded={foldout === 'layers'} disabled={!isModel}
								onClick={() => setFoldout((f) => (f === 'layers' ? null : 'layers'))}>
								layers <span>{foldout === 'layers' ? '▴' : '▾'}</span>
							</button>
							{foldout === 'layers' && isModel && (
								<div className="carving-layers">
									{shapes.map((s, i) => ({ s, i })).reverse().map(({ s, i }) => (
										<div key={s.id} data-layer={s.id} className={`carving-layer${selId === s.id ? ' carving-layer--sel' : ''}`}
											onClick={() => {
												setSelId(s.id);
												if (tool === 'nodes') {
													setNodeEdit(s.type === 'path' ? { shapeId: s.id, subs: parsePath(s.d ?? ''), sel: null } : null);
												}
											}}>
											<span className="carving-layer__glyph">{s.type === 'path' ? '∿' : s.type === 'ellipse' ? '◯' : s.type === 'rect' ? '▭' : '╱'}</span>
											<span className="carving-layer__name">{s.id}</span>
											<button type="button" className="carving-mini" title="raise" disabled={i === shapes.length - 1}
												onClick={(e) => { e.stopPropagation(); moveLayer(s.id, 1); }}>▲</button>
											<button type="button" className="carving-mini" title="lower" disabled={i === 0}
												onClick={(e) => { e.stopPropagation(); moveLayer(s.id, -1); }}>▼</button>
											<button type="button" className="carving-mini" title="delete this layer"
												onClick={(e) => { e.stopPropagation(); deleteLayer(s.id); }}>✕</button>
										</div>
									))}
									{shapes.length === 0 && <span className="carving-layers__empty">a bare block, carve something.</span>}
								</div>
							)}

							<button type="button" className="carving-fold" aria-expanded={foldout === 'ghost'} disabled={!isModel}
								onClick={() => setFoldout((f) => (f === 'ghost' ? null : 'ghost'))}>
								ghost <span>{foldout === 'ghost' ? '▴' : '▾'}</span>
							</button>
							{foldout === 'ghost' && isModel && (
								<div className="carving-ghostpick">
									<select className="input" aria-label="ghost a carving" value={ghostId ?? ''}
										onChange={(e) => setGhostId(e.target.value || null)}>
										<option value="">no ghost</option>
										{h.carvings.filter((c) => c.svg.trim()).map((c) => (
											<option key={c.id} value={c.id}>{c.name}</option>
										))}
									</select>
									<span className="footnote">// trace a carving behind the block.</span>
								</div>
							)}
						</div>
					)}
				</div>

				{/* the carving, at zoom */}
				{mode === 'note' ? (
					<div className="carving-empty">· not on this bench · see the note below ·</div>
				) : (
					<div ref={wrapRef} className="carving-canvas-wrap">
						<svg ref={svgRef} className={`carving-canvas${isModel ? '' : ' carving-canvas--locked'}${isModel && tool === 'select' ? ' carving-canvas--select' : ''}`}
							role="application" aria-label="carving canvas"
							onPointerDown={isModel ? onPointerDown : undefined}
							onPointerMove={isModel ? onPointerMove : undefined}
							onPointerUp={isModel ? onPointerUp : undefined}
							onPointerCancel={isModel ? onPointerCancel : undefined}>
							<g transform={`translate(${view.tx},${view.ty}) scale(${view.scale})`}>
								{ghostSvg && (
									<g className="carving-ghost" opacity={0.28} style={{ pointerEvents: 'none' }}>
										<svg x={vb.x} y={vb.y} width={vb.w} height={vb.h} viewBox={svgViewBox(ghostSvg)}
											preserveAspectRatio="xMidYMid meet"
											dangerouslySetInnerHTML={{ __html: safeSvg(svgInner(ghostSvg)) }} />
									</g>
								)}

								{isModel ? (
									<>
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

										{pencilTrace && pencilTrace.length > 1 && (
											<polyline points={pencilTrace.map((p) => `${p.x},${p.y}`).join(' ')}
												fill="none" stroke="var(--gold)" strokeWidth={px(1.4)} opacity={0.8} />
										)}

										{penDraft && (
											<g className="carving-pen">
												<path d={penPreviewD} fill="none" stroke="var(--gold)" strokeWidth={px(1.4)} strokeDasharray={`${px(4)} ${px(3)}`} />
												{penDraft.anchors.map((a, i) => (
													<circle key={i} cx={a.x} cy={a.y} r={i === 0 ? px(5) : px(3.5)}
														fill={i === 0 ? 'rgba(240,217,168,.35)' : 'var(--periwinkle)'}
														stroke="var(--gold)" strokeWidth={px(1)} />
												))}
											</g>
										)}

										{tool === 'select' && sel && selBox && (
											<g className="carving-selbox">
												<rect x={selBox.x - pad} y={selBox.y - pad} width={selBox.w + pad * 2} height={selBox.h + pad * 2}
													fill="none" stroke="var(--periwinkle)" strokeWidth={px(1)} strokeDasharray={`${px(4)} ${px(3)}`} />
												<line x1={selBox.x + selBox.w / 2} y1={selBox.y - pad} x2={selBox.x + selBox.w / 2} y2={selBox.y - pad - px(22)}
													stroke="var(--periwinkle)" strokeWidth={px(1)} />
												<circle className="carving-rotate" cx={selBox.x + selBox.w / 2} cy={selBox.y - pad - px(26)} r={px(6)}
													fill="var(--card)" stroke="var(--gold)" strokeWidth={px(1.2)} style={{ cursor: 'grab' }}
													onPointerDown={(e) => {
														overlayHit.current = {
															kind: 'rotate', id: sel.id, orig: sel,
															center: { x: selBox.x + selBox.w / 2, y: selBox.y + selBox.h / 2 },
															start: toWorld(e.clientX, e.clientY),
														};
													}} />
												{handleSpecs.map((spec) => (
													<rect key={`${spec.hx},${spec.hy}`} className="carving-handle"
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

										{tool === 'nodes' && nodeEdit && (
											<g className="carving-nodes">
												{nodeEdit.subs.map((sub, si) => {
													const n = sub.anchors.length;
													const segs = sub.closed ? n : n - 1;
													return Array.from({ length: segs }, (_, i) => {
														const a = sub.anchors[i];
														const b = sub.anchors[(i + 1) % n];
														const [p0, p1, p2, p3] = segmentCtrl(a, b);
														return (
															<path key={`${si}-${i}`} className="carving-seg"
																d={`M${p0.x} ${p0.y} C${p1.x} ${p1.y} ${p2.x} ${p2.y} ${p3.x} ${p3.y}`}
																fill="none" stroke="transparent" strokeWidth={px(14)} pointerEvents="stroke"
																style={{ cursor: 'copy' }}
																onPointerDown={(e) => {
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
																	<circle className="carving-node-handle" cx={a.in.x} cy={a.in.y} r={px(8)} fill="transparent"
																		style={{ cursor: 'pointer' }}
																		onPointerDown={() => { overlayHit.current = { kind: 'handle', sub: si, idx: ai, which: 'in' }; }} />
																	<circle cx={a.in.x} cy={a.in.y} r={px(2.4)} fill="var(--periwinkle-deep)" pointerEvents="none" />
																</>
															)}
															{a.out && (
																<>
																	<line x1={a.x} y1={a.y} x2={a.out.x} y2={a.out.y} stroke="var(--periwinkle-deep)" strokeWidth={px(.8)} />
																	<circle className="carving-node-handle" cx={a.out.x} cy={a.out.y} r={px(8)} fill="transparent"
																		style={{ cursor: 'pointer' }}
																		onPointerDown={() => { overlayHit.current = { kind: 'handle', sub: si, idx: ai, which: 'out' }; }} />
																	<circle cx={a.out.x} cy={a.out.y} r={px(2.4)} fill="var(--periwinkle-deep)" pointerEvents="none" />
																</>
															)}
															<circle className="carving-node" data-node={`${si}-${ai}`} cx={a.x} cy={a.y} r={px(10)}
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
									</>
								) : (
									<svg x={vb.x} y={vb.y} width={vb.w} height={vb.h} viewBox={svgViewBox(rawSvg)}
										preserveAspectRatio="xMidYMid meet"
										dangerouslySetInnerHTML={{ __html: safeSvg(svgInner(rawSvg)) }} />
								)}
							</g>
						</svg>

						{/* zoom cluster + bench swap */}
						<div className="carving-zoom">
							<button type="button" className="carving-zoom__swap" title="swap the bench top · navy or white"
								onClick={() => props.setBenchTop(props.benchTop === 'white' ? 'navy' : 'white')}>
								{props.benchTop === 'white' ? '● navy' : '○ white'}
							</button>
							<button type="button" className="carving-zoom__btn" title="zoom out" onClick={() => zoomCenter(1 / 1.3)}>−</button>
							<span className="carving-zoom__pct">{zoomPct}%</span>
							<button type="button" className="carving-zoom__btn" title="zoom in" onClick={() => zoomCenter(1.3)}>+</button>
							<button type="button" className="carving-zoom__fit" title="fit the bench" onClick={fitView}>fit</button>
						</div>
					</div>
				)}

				{mode === 'note' && props.loaded.kind === 'note' && (
					<span className="carving-bench__note">{props.loaded.entry.note}</span>
				)}
			</div>

			{/* the markup, tucked in a drawer */}
			{mode !== 'note' && (
				<div className="carving-drawer">
					<button type="button" className="carving-drawer__head" onClick={() => setDrawerOpen((o) => !o)}>
						<span className="carving-drawer__kicker">‹/› the markup</span>
						<span className="carving-drawer__right">
							<span className="carving-drawer__sub">what the chisels carve, written down. hand-edit it and the tools step back.</span>
							<span className="carving-drawer__chevron">{drawerOpen ? 'hide ▴' : 'show ▾'}</span>
						</span>
					</button>
					{drawerOpen && (
						mode === 'locked' ? (
							<div className="carving-drawer__body">
								<textarea className="input carving-src" value={currentSvg} readOnly spellCheck={false}
									aria-label="carving source, locked" rows={8} />
								<div className="carving-drawer__locked">
									<span className="footnote">a seed is carved, it stays. copy it to a fresh block to edit.</span>
									<button type="button" className="pill" onClick={() => void copyToFresh()}>copy to a fresh block</button>
								</div>
							</div>
						) : (
							<div className="carving-drawer__body">
								<textarea className="input carving-src" value={currentSvg} spellCheck={false}
									aria-label="carving source" rows={8}
									onChange={(e) => editMarkup(e.target.value)} />
							</div>
						)
					)}
				</div>
			)}

			{/* bolting */}
			{mode !== 'note' && (
				<div className="carving-bolt-row">
					<span className="carving-bolt-row__hint">◐ {spotHint} bolted carvings ship with the next hoist</span>
					<div className="carving-bolt-row__act">
						<span className="field-label">bolt to</span>
						<select className="input carving-assign" aria-label="bolt it to" value={props.assignSpot}
							onChange={(e) => props.setAssignSpot(e.target.value)}>
							{SPOTS.map((entry) => (
								<option key={entry.id} value={entry.id}>{entry.name} · {entry.page}</option>
							))}
						</select>
						<button type="button" className={`carving-bolt${bolted ? ' carving-bolt--done' : ''}`}
							disabled={!canBolt} onClick={() => void bolt()}>
							{bolted ? '✓ bolted · ships with the next hoist' : '⚒ bolt it into place'}
						</button>
					</div>
				</div>
			)}
		</>
	);
}

function benchKey(loaded: Loaded): string {
	if (loaded.kind === 'note') {
		return `note-${loaded.entry.id}`;
	}
	if (loaded.kind === 'fresh') {
		return `fresh-${loaded.nonce}`;
	}
	return `carving-${loaded.carving.id}`;
}

export default function CarvingShop() {
	const h = useHarbor();
	const [sel, setSel] = useState<Loaded | null>(null);
	const [assignSpot, setAssignSpot] = useState<string>(SPOTS[0].id);
	const [catOpen, setCatOpen] = useState(false);
	const [benchTop, setBenchTop] = useState<'navy' | 'white'>('navy');
	const [pal, setPalState] = useState({ x: 14, y: 64, open: true });
	const nonce = useRef(0);

	// Default the bench to whatever the first spot carries, once the catalog
	// has loaded; a keeper's own pick is never second-guessed after that.
	useEffect(() => {
		if (sel || !h.carvings.length) {
			return;
		}
		const carving = h.carvings.find((c) => c.boltedTo.includes(SPOTS[0].id));
		if (carving) {
			setSel({ kind: 'carving', carving });
		}
	}, [h.carvings, sel]);

	const select = (loaded: Loaded) => {
		setSel(loaded);
		setCatOpen(false);
	};

	const freshBlock = () => {
		const holder = h.carvings.find((c) => c.boltedTo.includes(assignSpot));
		const n = h.carvings.filter((c) => !c.builtin).length + 1;
		nonce.current += 1;
		select({
			kind: 'fresh', nonce: nonce.current, name: `fresh carving no. ${n}`,
			viewBox: STARTER_VIEWBOX, shapes: STARTER_SHAPES.map((s) => ({ ...s })),
			ghostId: holder?.id ?? null,
		});
	};

	return (
		<div className="carving-screen">
			<CatPerch quips={CAT_QUIPS} style={{ top: -10, right: 22 }} />
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the carvings</span>
				<span className="page-title">The carving shop</span>
				<span className="page-sub">Every carving on the site, catalogued and on the bench. The cat supervises; it has approved none of it.</span>
			</div>

			<div className="carving-body" style={{ animation: 'fadeUp .7s ease .15s both' }}>
				{sel && (
					<Bench key={benchKey(sel)} loaded={sel}
						assignSpot={assignSpot} setAssignSpot={setAssignSpot}
						catOpen={catOpen} setCatOpen={setCatOpen}
						benchTop={benchTop} setBenchTop={setBenchTop}
						palX={pal.x} palY={pal.y} palOpen={pal.open}
						setPal={(p) => setPalState((cur) => ({ ...cur, ...p }))}
						onSelect={select} onFresh={freshBlock} />
				)}
			</div>
		</div>
	);
}
