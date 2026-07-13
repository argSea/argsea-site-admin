// The chart: the fleet office's drag surface. Every charted hobby is a mark at
// its bearing, dragged to re-plot it; a hobby that slipped its mooring trails a
// wake whose origin drags on its own handle; the uncharted wait in a tray to be
// dragged onto the waters. A scatter chip re-plots the whole fleet at once. All
// of it is local until the keeper pins it, and the projection is the exact
// inverse of the public chart's, so what lands here lands there.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { Coord, Hobby } from '../lib/api';
import { MEMORIAL_COORD, STATE_COLOR, proj, scatterBearing, snapToBand, unproj, wakePath, type XY } from '../lib/chart';
import './BearingChart.css';

interface Placement {
	coord: Coord | null;
	from:  Coord | null;
}

type Layout = Record<string, Placement>;
type Endpoint = 'coord' | 'from';

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

const coordKey = (c: Coord | null): string => (c ? `${c.lat},${c.lon}` : '-');

function sameCoord(a: Coord | null, b: Coord | null): boolean {
	if (!a || !b) {
		return a === b;
	}
	return a.lat === b.lat && a.lon === b.lon;
}

function initialLayout(hobbies: Hobby[]): Layout {
	const layout: Layout = {};
	hobbies.forEach((hobby) => { layout[hobby.id] = { coord: hobby.coord, from: hobby.from }; });
	return layout;
}

export default function BearingChart() {
	const h = useHarbor();
	const hobbies = h.hobbies;

	const [layout, setLayout] = useState<Layout>(() => initialLayout(hobbies));
	const [grabbed, setGrabbed] = useState<string | null>(null);
	const [ghost, setGhost] = useState<{ id: string; cx: number; cy: number } | null>(null);
	const [saving, setSaving] = useState(false);

	const bandRef = useRef<HTMLDivElement>(null);
	const drag = useRef<{ id: string; end: Endpoint } | null>(null);
	const trayDrag = useRef<string | null>(null);

	// A pin (or an edit-overlay fine-tune) lands new server bearings; reseed the
	// local layout off them so a pinned mark is no longer counted as moved. Keyed
	// on the coords themselves, so a live drag (server unchanged) is left alone.
	const serverKey = hobbies.map((hobby) => `${hobby.id}:${coordKey(hobby.coord)}:${coordKey(hobby.from)}`).join('|');
	useEffect(() => {
		setLayout(initialLayout(hobbies));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [serverKey]);

	const posFromBand = useCallback((event: ReactPointerEvent): XY | null => {
		const band = bandRef.current;
		if (!band) {
			return null;
		}
		const rect = band.getBoundingClientRect();
		return {
			x: clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100),
			y: clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100),
		};
	}, []);

	const onMarkDown = useCallback((event: ReactPointerEvent<HTMLElement>, id: string, end: Endpoint) => {
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { id, end };
		setGrabbed(id);
	}, []);

	const onMarkMove = useCallback((event: ReactPointerEvent<HTMLElement>, id: string, end: Endpoint) => {
		if (!drag.current || drag.current.id !== id || drag.current.end !== end) {
			return;
		}
		const pos = posFromBand(event);
		if (pos) {
			setLayout((cur) => ({ ...cur, [id]: { ...cur[id], [end]: unproj(pos) } }));
		}
	}, [posFromBand]);

	const onMarkUp = useCallback((event: ReactPointerEvent<HTMLElement>, id: string, end: Endpoint) => {
		if (drag.current && drag.current.id === id && drag.current.end === end) {
			event.currentTarget.releasePointerCapture(event.pointerId);
			drag.current = null;
		}
		setGrabbed((cur) => (cur === id ? null : cur));
	}, []);

	// The tray chip stays mounted through its drag (a ghost mark trails the
	// pointer); only on release, if the drop is over the waters, does the hobby
	// take a coord and jump onto the chart.
	const onTrayDown = useCallback((event: ReactPointerEvent<HTMLSpanElement>, id: string) => {
		event.currentTarget.setPointerCapture(event.pointerId);
		trayDrag.current = id;
		setGhost({ id, cx: event.clientX, cy: event.clientY });
	}, []);

	const onTrayMove = useCallback((event: ReactPointerEvent<HTMLSpanElement>, id: string) => {
		if (trayDrag.current !== id) {
			return;
		}
		setGhost({ id, cx: event.clientX, cy: event.clientY });
	}, []);

	const onTrayUp = useCallback((event: ReactPointerEvent<HTMLSpanElement>, id: string) => {
		if (trayDrag.current !== id) {
			return;
		}
		event.currentTarget.releasePointerCapture(event.pointerId);
		trayDrag.current = null;
		setGhost(null);
		const band = bandRef.current;
		if (!band) {
			return;
		}
		const rect = band.getBoundingClientRect();
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		if (x < 0 || x > 100 || y < 0 || y > 100) {
			return;
		}
		setLayout((cur) => ({ ...cur, [id]: { coord: unproj({ x, y }), from: cur[id]?.from ?? null } }));
	}, []);

	const scatter = useCallback(() => {
		setLayout(() => {
			const next: Layout = {};
			// wake-ness follows the model: a hobby the site draws a wake for (it
			// carries a `from`) gets a fresh origin near its new mark; one it draws
			// none for keeps `from` null.
			hobbies.forEach((hobby) => { next[hobby.id] = scatterBearing(hobby.state, Boolean(hobby.from)); });
			return next;
		});
	}, [hobbies]);

	// Only the hobbies whose bearing actually changed, as full documents with the
	// positions clamped to the band, ready for the pin's per-hobby PUT.
	const moved = useMemo(() => {
		const docs: Hobby[] = [];
		hobbies.forEach((hobby) => {
			const place = layout[hobby.id];
			if (!place) {
				return;
			}
			const coord = place.coord ? snapToBand(place.coord) : null;
			const from = place.from ? snapToBand(place.from) : null;
			if (sameCoord(coord, hobby.coord) && sameCoord(from, hobby.from)) {
				return;
			}
			docs.push({ ...hobby, coord, from });
		});
		return docs;
	}, [hobbies, layout]);

	const pin = useCallback(async () => {
		setSaving(true);
		try {
			await h.pinBearings(moved);
		} finally {
			setSaving(false);
		}
	}, [h, moved]);

	const charted = hobbies.filter((hobby) => layout[hobby.id]?.coord);
	const uncharted = hobbies.filter((hobby) => !layout[hobby.id]?.coord);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .5s ease both' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
				<span className="footnote">// drag a ship to set its bearing · a wake's origin drags on its own handle · nothing saves until you pin</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<span className="chip-dashed" onClick={scatter}>↯ scatter the fleet</span>
					<button className="btn btn--gold" disabled={saving || 0 === moved.length} onClick={() => void pin()}>
						{saving ? 'pinning…' : 'pin the fleet'}
					</button>
				</div>
			</div>

			<div className="bearing-chart" ref={bandRef}>
				{/* the memorial's light: the fixed reference the moored cluster keeps to */}
				<div className="bearing-memorial" style={markPos(proj(MEMORIAL_COORD))}>
					<span className="bearing-memorial__dot" />
					<span className="bearing-memorial__label">Eilean Mòr</span>
				</div>

				{/* wakes trail under the marks, redrawn live as either endpoint moves */}
				<svg className="bearing-wakes" viewBox="0 0 100 100" preserveAspectRatio="none">
					{charted.map((hobby) => {
						const place = layout[hobby.id];
						if (!place.from || !place.coord) {
							return null;
						}
						const wake = wakePath(place.from, place.coord);
						return (
							<path key={hobby.id} d={wake.d} fill="none" stroke={STATE_COLOR[hobby.state]}
								strokeWidth="0.3" strokeDasharray="0.8 1.8" strokeLinecap="round" opacity={0.6} />
						);
					})}
				</svg>

				{/* a wake's origin handle, dragged to move where the drift began */}
				{charted.map((hobby) => {
					const place = layout[hobby.id];
					if (!place.from) {
						return null;
					}
					return (
						<span key={`from-${hobby.id}`} data-from-handle data-hobby-id={hobby.id}
							className="bearing-handle" style={{ ...markPos(proj(place.from)), borderColor: STATE_COLOR[hobby.state] }}
							onPointerDown={(e) => onMarkDown(e, hobby.id, 'from')}
							onPointerMove={(e) => onMarkMove(e, hobby.id, 'from')}
							onPointerUp={(e) => onMarkUp(e, hobby.id, 'from')}
							title={`${hobby.name} · where it slipped its mooring`} />
					);
				})}

				{/* the ships themselves, each dragged to re-plot its bearing */}
				{charted.map((hobby) => {
					const place = layout[hobby.id];
					if (!place.coord) {
						return null;
					}
					return (
						<div key={hobby.id} data-mark data-hobby-id={hobby.id} data-state={hobby.state}
							className={`bearing-mark${grabbed === hobby.id ? ' bearing-mark--active' : ''}`}
							style={markPos(proj(place.coord))} title={hobby.bearing}>
							<span className="bearing-mark__dot" style={{ background: STATE_COLOR[hobby.state], borderStyle: 'moored' === hobby.state ? 'dashed' : 'solid' }}
								onPointerDown={(e) => onMarkDown(e, hobby.id, 'coord')}
								onPointerMove={(e) => onMarkMove(e, hobby.id, 'coord')}
								onPointerUp={(e) => onMarkUp(e, hobby.id, 'coord')} />
							<span className="bearing-mark__title" style={{ color: STATE_COLOR[hobby.state] }}>{hobby.name}</span>
						</div>
					);
				})}

				{/* the ghost mark that trails the pointer while a tray chip is in hand */}
				{ghost && (
					<div className="bearing-ghost" style={{ left: ghost.cx, top: ghost.cy }}>
						<span className="bearing-ghost__dot" />
					</div>
				)}
			</div>

			<div className="bearing-tray" data-tray>
				<span className="card-kicker">uncharted · drag a ship onto the waters</span>
				<div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
					{uncharted.map((hobby) => (
						<span key={hobby.id} data-tray-chip data-hobby-id={hobby.id}
							className={`bearing-tray__chip${ghost?.id === hobby.id ? ' bearing-tray__chip--held' : ''}`}
							onPointerDown={(e) => onTrayDown(e, hobby.id)}
							onPointerMove={(e) => onTrayMove(e, hobby.id)}
							onPointerUp={(e) => onTrayUp(e, hobby.id)}>
							{hobby.name}
						</span>
					))}
					{0 === uncharted.length && (
						<span style={{ fontSize: 13.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
							every hobby is on the chart. drag one off? not from here.
						</span>
					)}
				</div>
			</div>

			<span className="footnote">// bearings ship to the public chart on the next lantern hoist.</span>
		</div>
	);
}

function markPos(p: XY): React.CSSProperties {
	return { left: `${p.x}%`, top: `${p.y}%` };
}
