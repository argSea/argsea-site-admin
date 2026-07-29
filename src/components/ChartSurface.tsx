// The chart table: one helm-window drag surface where every chartable is placed.
// Lights, hobbies and journal notes are marks at their berths, dragged to
// re-plot them; a hobby that slipped its mooring trails a wake whose origin
// drags on its own handle; the uncharted wait on the shelf to be dragged onto
// the waters, and a mark dragged off them goes back to the shelf. The sheet
// beside the chart picks which print leads and writes the caption, so placement,
// print and caption never need another screen. All of it is local until the
// keeper pins it, and the projection is the public Helm's own, so what lands
// here lands there.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { Berths } from '../state/harbor';
import type { Coord, Hobby, HobbyState, Note, Project } from '../lib/api';
import {
	CHART_H, CHART_W, ISLETS, MEMORIAL_COORD, STATE_COLOR,
	coastPath, proj, projPx, scatterBearing, snapToBand, unproj, wakePath, type XY,
} from '../lib/chart';
import { printBackground } from '../lib/prints';
import './ChartSurface.css';

// The wandering chart's slot shows the same surface narrowed to hobbies, with
// the hobby-only chrome (the scatter chip) along for the ride.
export type Lens = 'all' | 'hobbies';

type Kind = 'project' | 'hobby' | 'note';

// What the keeper can change here, held locally until the pin. Every chartable
// carries all of it; `from` only ever moves on a hobby.
interface Berth {
	coord: Coord | null;
	from:  Coord | null;
	plate: number;
	cap:   string;
}

// A chartable as this screen reads it: the placement, the dressing, and enough
// identity to draw the mark and rebuild the document the pin sends. The gallery
// rides along read-only, to draw the plates the sheet picks from; hanging a
// print is the entry's own editor's job.
interface Chartable extends Berth {
	key:    string;
	kind:   Kind;
	id:     string;
	name:   string;
	code:   string;
	icon:   IconName;
	tint:   string;
	images: string[];
	doc:    Project | Hobby | Note;
}

type IconName = 'light' | 'bottle' | HobbyState;

// The mark glyphs, transcribed from the Helm's own rail icons: a state is drawn,
// never chosen, so the office and the public chart can't disagree about what a
// mark is. Lights fly the beacon, notes the bottle, hobbies their state.
const ICONS: Record<IconName, React.JSX.Element> = {
	light: (
		<svg width="11" height="16" viewBox="0 0 20 30" fill="none">
			<path d="M10 2 L13 8 L7 8 Z" fill="#f0d9a8" />
			<rect x="7.5" y="8" width="5" height="13" fill="none" stroke="#f0d9a8" strokeWidth="1.8" />
			<path d="M4 26 q6 -3 12 0" stroke="#5f6ec4" strokeWidth="2" fill="none" />
		</svg>
	),
	bottle: (
		<svg width="14" height="9" viewBox="0 0 40 24" fill="none">
			<rect x="2" y="5" width="28" height="13" rx="6.5" fill="rgba(147,160,232,.25)" stroke="#93a0e8" strokeWidth="2.4" />
			<rect x="31" y="8" width="7" height="7" rx="1.5" fill="#f0d9a8" />
		</svg>
	),
	moored: (
		<svg width="13" height="14" viewBox="0 0 26 30" fill="none">
			<path d="M13 2 L17 9 L9 9 Z" fill="#f0d9a8" />
			<rect x="10" y="9" width="6" height="14" fill="none" stroke="#93a0e8" strokeWidth="2" />
			<path d="M6 27 q7 -4 14 0" stroke="#5f6ec4" strokeWidth="2" fill="none" />
		</svg>
	),
	adrift: (
		<svg width="14" height="12" viewBox="0 0 30 24" fill="none">
			<path d="M4 15 L26 15 L21 22 L9 22 Z" fill="#93a0e8" />
			<path d="M15 15 V3" stroke="#5f6ec4" strokeWidth="2" />
			<path d="M15 3 L24 13 L15 13 Z" fill="#f0d9a8" />
		</svg>
	),
	marooned: (
		<svg width="13" height="13" viewBox="0 0 30 30" fill="none">
			<path d="M14 28 q-2 -12 1 -20" stroke="#8a7142" strokeWidth="2.4" fill="none" strokeLinecap="round" />
			<path d="M15 8 q-8 -3 -13 1 M15 8 q8 -3 13 1 M15 8 q-5 -6 -12 -6 M15 8 q5 -6 12 -6" stroke="#5f8a5f" strokeWidth="2.2" fill="none" strokeLinecap="round" />
		</svg>
	),
	port: (
		<svg width="12" height="13" viewBox="0 0 26 30" fill="none">
			<circle cx="13" cy="5" r="3" stroke="#6fca97" strokeWidth="2.2" />
			<path d="M13 8 V26 M6 15 H20" stroke="#6fca97" strokeWidth="2.2" />
			<path d="M5 22 q8 7 16 0" stroke="#6fca97" strokeWidth="2.2" fill="none" strokeLinecap="round" />
		</svg>
	),
	inkspill: <span className="chart-mark__ink" />,
};

const KIND_LABEL: Record<Kind, string> = { project: 'a light', hobby: 'a hobby', note: 'a note' };

// A light reads gold while it burns and goes cool once it's extinguished, the
// same test the public chart dims on.
const LIGHT_TINT = '#f0d9a8';
const DARK_TINT = '#8a93c4';
const NOTE_TINT = '#93a0e8';

const coordKey = (c: Coord | null): string => (c ? `${c.lat},${c.lon}` : '-');

function sameCoord(a: Coord | null, b: Coord | null): boolean {
	if (!a || !b) {
		return a === b;
	}
	return a.lat === b.lat && a.lon === b.lon;
}

// A cleared gallery reads back null after a write (contract: chart-berths,
// Amendment 3), so nothing here may tell null and [] apart.
const gallery = (images: string[] | null | undefined): string[] => images ?? [];

function projectMark(p: Project): Chartable {
	return {
		key: `project:${p.id}`, kind: 'project', id: p.id, name: p.title, code: p.category,
		icon: 'light', tint: p.light?.extinguished ? DARK_TINT : LIGHT_TINT, doc: p,
		coord: p.coord ?? null, from: null, plate: p.plate ?? 0, cap: p.cap ?? '', images: gallery(p.images),
	};
}

function hobbyMark(h: Hobby): Chartable {
	return {
		key: `hobby:${h.id}`, kind: 'hobby', id: h.id, name: h.name, code: h.state,
		icon: h.state, tint: STATE_COLOR[h.state], doc: h,
		coord: h.coord, from: h.from, plate: h.plate ?? 0, cap: h.cap ?? '', images: gallery(h.images),
	};
}

function noteMark(n: Note): Chartable {
	return {
		key: `note:${n.id}`, kind: 'note', id: n.id, name: n.title, code: n.date,
		icon: 'bottle', tint: NOTE_TINT, doc: n,
		coord: n.coord ?? null, from: null, plate: n.plate ?? 0, cap: n.cap ?? '', images: [],
	};
}

const berthOf = (c: Chartable): Berth => ({ coord: c.coord, from: c.from, plate: c.plate, cap: c.cap });

export default function ChartSurface({ lens }: { lens: Lens }) {
	const h = useHarbor();

	const chartables = useMemo((): Chartable[] => {
		const hobbies = h.hobbies.map(hobbyMark);
		if ('hobbies' === lens) {
			return hobbies;
		}
		return [...h.projects.map(projectMark), ...hobbies, ...h.notes.map(noteMark)];
	}, [h.projects, h.hobbies, h.notes, lens]);

	const [berths, setBerths] = useState<Record<string, Berth>>(() => seed(chartables));
	const [selected, setSelected] = useState<string | null>(null);
	const [grabbed, setGrabbed] = useState<string | null>(null);
	const [ghost, setGhost] = useState<{ key: string; cx: number; cy: number } | null>(null);
	const [saving, setSaving] = useState(false);

	const bandRef = useRef<HTMLDivElement>(null);
	const drag = useRef<{ key: string; end: 'coord' | 'from' } | null>(null);
	const shelfDrag = useRef<string | null>(null);

	// A pin lands new server berths; reseed the local table off them so a pinned
	// mark is no longer counted as moved. Keyed on the berths themselves, so a
	// live drag (server unchanged) is left alone.
	const serverKey = chartables
		.map((c) => `${c.key}:${coordKey(c.coord)}:${coordKey(c.from)}:${c.plate}:${c.cap}:${c.images.join('+')}`)
		.join('|');
	useEffect(() => {
		setBerths(seed(chartables));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [serverKey]);

	const patch = useCallback((key: string, fields: Partial<Berth>) => {
		setBerths((cur) => (cur[key] ? { ...cur, [key]: { ...cur[key], ...fields } } : cur));
	}, []);

	const bandRect = useCallback((): DOMRect | null => bandRef.current?.getBoundingClientRect() ?? null, []);

	const posInBand = useCallback((event: ReactPointerEvent): XY | null => {
		const rect = bandRect();
		if (!rect) {
			return null;
		}
		return {
			x: ((event.clientX - rect.left) / rect.width) * 100,
			y: ((event.clientY - rect.top) / rect.height) * 100,
		};
	}, [bandRect]);

	const onMarkDown = useCallback((event: ReactPointerEvent<HTMLElement>, key: string, end: 'coord' | 'from') => {
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { key, end };
		setGrabbed(key);
		setSelected(key);
	}, []);

	const onMarkMove = useCallback((event: ReactPointerEvent<HTMLElement>, key: string, end: 'coord' | 'from') => {
		if (!drag.current || drag.current.key !== key || drag.current.end !== end) {
			return;
		}
		const pos = posInBand(event);
		if (!pos) {
			return;
		}
		const at = unproj({ x: clampPct(pos.x), y: clampPct(pos.y) });
		patch(key, 'coord' === end ? { coord: at } : { from: at });
	}, [posInBand, patch]);

	// Released over the waters the mark keeps its new bearing; released off them
	// it comes off the chart entirely and drops back on the shelf, wake and all.
	const onMarkUp = useCallback((event: ReactPointerEvent<HTMLElement>, key: string, end: 'coord' | 'from') => {
		if (!drag.current || drag.current.key !== key || drag.current.end !== end) {
			return;
		}
		event.currentTarget.releasePointerCapture(event.pointerId);
		drag.current = null;
		setGrabbed(null);
		const pos = posInBand(event);
		if ('coord' === end && pos && !inside(pos)) {
			patch(key, { coord: null, from: null });
		}
	}, [posInBand, patch]);

	// The shelf chip stays mounted through its drag (a ghost mark trails the
	// pointer); only on release, if the drop is over the waters, does the entry
	// take a berth and jump onto the chart.
	const onShelfDown = useCallback((event: ReactPointerEvent<HTMLSpanElement>, key: string) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		shelfDrag.current = key;
		setSelected(key);
		setGhost({ key, cx: event.clientX, cy: event.clientY });
	}, []);

	const onShelfMove = useCallback((event: ReactPointerEvent<HTMLSpanElement>, key: string) => {
		if (shelfDrag.current === key) {
			setGhost({ key, cx: event.clientX, cy: event.clientY });
		}
	}, []);

	const onShelfUp = useCallback((event: ReactPointerEvent<HTMLSpanElement>, key: string) => {
		if (shelfDrag.current !== key) {
			return;
		}
		event.currentTarget.releasePointerCapture(event.pointerId);
		shelfDrag.current = null;
		setGhost(null);
		const pos = posInBand(event);
		if (pos && inside(pos)) {
			patch(key, { coord: unproj(pos) });
		}
	}, [posInBand, patch]);

	const scatter = useCallback(() => {
		setBerths((cur) => {
			const next = { ...cur };
			// wake-ness follows the model: a hobby the site draws a wake for (it
			// carries a `from`) gets a fresh origin near its new mark; one it draws
			// none for keeps `from` null.
			chartables.forEach((c) => {
				if ('hobby' !== c.kind) {
					return;
				}
				const place = scatterBearing((c.doc as Hobby).state, Boolean(c.from));
				next[c.key] = { ...next[c.key], ...place };
			});
			return next;
		});
	}, [chartables]);

	// Only the entries whose berth actually changed, as full documents with the
	// placements clamped to the band, ready for the pin's per-entity PUT.
	const moved = useMemo((): Berths => {
		const out: Berths = { projects: [], hobbies: [], notes: [] };
		chartables.forEach((c) => {
			const berth = berths[c.key];
			if (!berth) {
				return;
			}
			const coord = berth.coord ? snapToBand(berth.coord) : null;
			const from = berth.coord && berth.from ? snapToBand(berth.from) : null;
			const cap = berth.cap.trim();
			const plate = Math.max(0, Math.trunc(berth.plate));
			// The invariant a wake rides on: no coord, no wake, on the chart and on
			// the wire alike. An uncharted document can still carry a stored `from`,
			// and the baseline has to read it the same way the placement above does,
			// or every such hobby counts as moved the moment the table loads and the
			// next pin writes its origin away.
			const wasFrom = c.coord ? c.from : null;
			if (sameCoord(coord, c.coord) && sameCoord(from, wasFrom) && plate === c.plate && cap === c.cap) {
				return;
			}
			if ('project' === c.kind) {
				out.projects.push({ ...(c.doc as Project), coord, plate, cap });
			} else if ('note' === c.kind) {
				out.notes.push({ ...(c.doc as Note), coord, plate, cap });
			} else {
				out.hobbies.push({ ...(c.doc as Hobby), coord, from, plate, cap });
			}
		});
		return out;
	}, [chartables, berths]);

	const movedCount = moved.projects.length + moved.hobbies.length + moved.notes.length;

	const pin = useCallback(async () => {
		setSaving(true);
		try {
			await h.pinBerths(moved);
		} finally {
			setSaving(false);
		}
	}, [h, moved]);

	const charted = chartables.filter((c) => berths[c.key]?.coord);
	const shelved = chartables.filter((c) => !berths[c.key]?.coord);
	const chosen = chartables.find((c) => c.key === selected) ?? null;

	return (
		<div className="chart-table">
			<div className="chart-table__bar">
				<span className="footnote">
					// drag a mark to set its berth · drag it off the waters to unchart it · nothing saves until you pin
				</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					{'hobbies' === lens && <span className="chip-dashed" onClick={scatter}>↯ scatter the fleet</span>}
					<button className="btn btn--gold" disabled={saving || 0 === movedCount} onClick={() => void pin()}>
						{saving ? 'pinning…' : 'pin the chart'}
					</button>
				</div>
			</div>

			<div className="chart-band" ref={bandRef} style={{ aspectRatio: `${CHART_W} / ${CHART_H}` }}>
				<svg className="chart-band__paper" viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none">
					<path d={coastPath()} fill="rgba(27,35,56,.85)" stroke="rgba(198,160,82,.45)" strokeWidth="2" />
					{ISLETS.map((islet) => {
						const p = projPx(islet);
						return <circle key={islet.name} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={islet.r * 1.6}
							fill="#1b2338" stroke="rgba(198,160,82,.7)" strokeWidth="2" />;
					})}
					{/* wakes trail under the marks, redrawn live as either endpoint moves */}
					{charted.map((c) => {
						const berth = berths[c.key];
						if (!berth.from || !berth.coord) {
							return null;
						}
						return <path key={c.key} d={wakePath(berth.from, berth.coord)} fill="none" stroke={c.tint}
							strokeWidth="4" strokeDasharray="10 22" strokeLinecap="round" opacity={0.6} />;
					})}
				</svg>

				<span className="chart-memorial" style={markPos(proj(MEMORIAL_COORD))}>Eilean Mòr</span>

				{/* a wake's origin handle, dragged to move where the drift began */}
				{charted.map((c) => {
					const berth = berths[c.key];
					if (!berth.from) {
						return null;
					}
					return (
						<span key={`from-${c.key}`} data-from-handle data-key={c.key} className="chart-handle"
							style={{ ...markPos(proj(berth.from)), borderColor: c.tint }}
							onPointerDown={(e) => onMarkDown(e, c.key, 'from')}
							onPointerMove={(e) => onMarkMove(e, c.key, 'from')}
							onPointerUp={(e) => onMarkUp(e, c.key, 'from')}
							title={`${c.name} · where it slipped its mooring`} />
					);
				})}

				{charted.map((c) => (
					<div key={c.key} data-mark data-key={c.key} data-kind={c.kind}
						className={`chart-mark${grabbed === c.key ? ' chart-mark--active' : ''}${selected === c.key ? ' chart-mark--chosen' : ''}`}
						style={markPos(proj(berths[c.key].coord as Coord))} title={c.code}>
						<span className="chart-mark__glyph"
							onPointerDown={(e) => onMarkDown(e, c.key, 'coord')}
							onPointerMove={(e) => onMarkMove(e, c.key, 'coord')}
							onPointerUp={(e) => onMarkUp(e, c.key, 'coord')}>
							{ICONS[c.icon]}
						</span>
						<span className="chart-mark__title" style={{ color: c.tint }}>{c.name}</span>
					</div>
				))}

				{ghost && (
					<div className="chart-ghost" style={{ left: ghost.cx, top: ghost.cy }}>
						<span className="chart-ghost__dot" />
					</div>
				)}
			</div>

			<div className="chart-table__desk">
				<div className="chart-shelf" data-shelf>
					<span className="card-kicker">uncharted · drag one onto the waters</span>
					<div className="chart-shelf__chips">
						{shelved.map((c) => (
							<span key={c.key} data-shelf-chip data-key={c.key} data-kind={c.kind}
								className={`chart-shelf__chip${ghost?.key === c.key ? ' chart-shelf__chip--held' : ''}`}
								onPointerDown={(e) => onShelfDown(e, c.key)}
								onPointerMove={(e) => onShelfMove(e, c.key)}
								onPointerUp={(e) => onShelfUp(e, c.key)}>
								<span className="chart-shelf__glyph">{ICONS[c.icon]}</span>
								{c.name}
							</span>
						))}
						{0 === shelved.length && (
							<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
								everything is on the chart. nothing waiting on the shelf.
							</span>
						)}
					</div>
				</div>

				{chosen ? <Sheet chartable={chosen} berth={berths[chosen.key]} patch={patch} /> : (
					<div className="chart-sheet chart-sheet--empty">
						<span className="card-kicker">the sheet</span>
						<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
							Pick a mark and its plate and caption open here.
						</span>
					</div>
				)}
			</div>

			<span className="footnote">// berths ship to the public chart on the next lantern hoist.</span>
		</div>
	);
}

// The mark's own sheet: which of its prints leads on the chart, and the line
// under that print. The gallery itself belongs to the entry's own editor for
// every kind, so the sheet picks from what is hung and never hangs anything.
function Sheet({ chartable, berth, patch }: { chartable: Chartable; berth: Berth; patch: (key: string, fields: Partial<Berth>) => void }) {
	const h = useHarbor();

	return (
		<div className="chart-sheet" data-sheet data-key={chartable.key}>
			<div className="chart-sheet__head">
				<span className="card-kicker">{KIND_LABEL[chartable.kind]} · {chartable.code}</span>
				<span className="chart-sheet__name">{chartable.name}</span>
			</div>

			{'note' === chartable.kind ? (
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>
					// a note's sheet shows its doodle · there is no plate to pick here
				</span>
			) : (
				<>
					<span className="field-label">the leading print · shows on the sheet</span>
					{chartable.images.length > 0 ? (
						<div className="chart-plates">
							{chartable.images.map((name, index) => (
								<span key={`${name}-${index}`} data-plate={index}
									className={`chart-plate${index === berth.plate ? ' chart-plate--leading' : ''}`}
									title={name} onClick={() => patch(chartable.key, { plate: index })}
									style={{ background: printBackground(h.prints, name) }} />
							))}
						</div>
					) : (
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>
							{'hobby' === chartable.kind
								? '// nothing hung on this mark · hang prints in the wandering chart'
								: "// no prints in this light's archive · hang them in the light list"}
						</span>
					)}
				</>
			)}

			<label className="field">
				<span className="field-label">caption · the line under the plate</span>
				<input type="text" className="input input--serif-italic" value={berth.cap}
					onChange={(e) => patch(chartable.key, { cap: e.target.value })} />
			</label>

			{berth.coord && (
				<span className="chip-dashed" data-unchart onClick={() => patch(chartable.key, { coord: null, from: null })}>
					↩ take it off the chart
				</span>
			)}
		</div>
	);
}

function seed(chartables: Chartable[]): Record<string, Berth> {
	const table: Record<string, Berth> = {};
	chartables.forEach((c) => { table[c.key] = berthOf(c); });
	return table;
}

const clampPct = (n: number): number => Math.max(0, Math.min(100, n));

const inside = (p: XY): boolean => p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= 100;

function markPos(p: XY): React.CSSProperties {
	return { left: `${p.x}%`, top: `${p.y}%` };
}
