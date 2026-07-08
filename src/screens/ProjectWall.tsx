// The wall: drag published postcards into place, tilt them, then pin the
// arrangement. Positions are stored as percentages of THIS canvas, which
// shares the public wall's aspect ratio so the admin view stays WYSIWYG.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { Project } from '../lib/api';
import { printBackground } from '../lib/prints';
import './ProjectWall.css';

interface CardPos { x: number; y: number; rotation: number }

// the public wall's own footprint (~1150:840); the tidy-grid defaults below
// are the comp's px layout converted against this same reference
const CANVAS_W = 1150;
const CANVAS_H = 840;
const ROT_LIMIT = 30;

function defaultPos(i: number): CardPos {
	return {
		x: ((30 + (i % 4) * 218) / CANVAS_W) * 100,
		y: ((34 + Math.floor(i / 4) * 190) / CANVAS_H) * 100,
		rotation: 0,
	};
}

function initialLayout(published: Project[]): Record<string, CardPos> {
	const layout: Record<string, CardPos> = {};
	published.forEach((p, i) => {
		layout[p.id] = p.wallPos ? { x: p.wallPos.x, y: p.wallPos.y, rotation: p.wallPos.rotation } : defaultPos(i);
	});
	return layout;
}

interface RotateGrab { id: string; cx: number; cy: number; a0: number; r0: number }

export default function ProjectWall() {
	const h = useHarbor();
	const published = useMemo(() => h.projects.filter((p) => p.status === 'published'), [h.projects]);
	const publishedKey = published.map((p) => p.id).join('|');

	const [layout, setLayout] = useState<Record<string, CardPos>>(() => initialLayout(published));
	const [grabbedId, setGrabbedId] = useState<string | null>(null);
	const [rotatingId, setRotatingId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const canvasRef = useRef<HTMLDivElement>(null);
	const dragGrab = useRef<{ id: string; offX: number; offY: number; canvasRect: DOMRect } | null>(null);
	const rotateGrab = useRef<RotateGrab | null>(null);

	// a newly-published card joins the wall seeded into the tidy grid; existing
	// placements (saved or mid-drag) are left alone
	useEffect(() => {
		setLayout((cur) => {
			let changed = false;
			const next = { ...cur };
			published.forEach((p, i) => {
				if (!next[p.id]) {
					next[p.id] = p.wallPos ? { x: p.wallPos.x, y: p.wallPos.y, rotation: p.wallPos.rotation } : defaultPos(i);
					changed = true;
				}
			});
			return changed ? next : cur;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [publishedKey]);

	const onCardPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		if (!canvasRef.current) {
			return;
		}
		e.currentTarget.setPointerCapture(e.pointerId);
		const cardRect = e.currentTarget.getBoundingClientRect();
		const canvasRect = canvasRef.current.getBoundingClientRect();
		dragGrab.current = { id, offX: e.clientX - cardRect.left, offY: e.clientY - cardRect.top, canvasRect };
		setGrabbedId(id);
	}, []);

	const onCardPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		const grab = dragGrab.current;
		if (!grab || grab.id !== id) {
			return;
		}
		const leftPx = e.clientX - grab.canvasRect.left - grab.offX;
		const topPx = e.clientY - grab.canvasRect.top - grab.offY;
		const x = (leftPx / grab.canvasRect.width) * 100;
		const y = (topPx / grab.canvasRect.height) * 100;
		setLayout((cur) => ({ ...cur, [id]: { ...cur[id], x, y } }));
	}, []);

	const onCardPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		if (dragGrab.current?.id === id) {
			e.currentTarget.releasePointerCapture(e.pointerId);
			dragGrab.current = null;
		}
		setGrabbedId((cur) => (cur === id ? null : cur));
	}, []);

	const onRotatePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		e.stopPropagation();
		e.currentTarget.setPointerCapture(e.pointerId);
		const cardEl = e.currentTarget.parentElement;
		if (!cardEl) {
			return;
		}
		const rect = cardEl.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;
		const a0 = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
		const r0 = layout[id]?.rotation ?? 0;
		rotateGrab.current = { id, cx, cy, a0, r0 };
		setRotatingId(id);
	}, [layout]);

	const onRotatePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		const grab = rotateGrab.current;
		if (!grab || grab.id !== id) {
			return;
		}
		const a1 = Math.atan2(e.clientY - grab.cy, e.clientX - grab.cx) * 180 / Math.PI;
		const raw = grab.r0 + (a1 - grab.a0);
		const rotation = Math.max(-ROT_LIMIT, Math.min(ROT_LIMIT, Math.round(raw * 10) / 10));
		setLayout((cur) => ({ ...cur, [id]: { ...cur[id], rotation } }));
	}, []);

	const onRotatePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		e.stopPropagation();
		if (rotateGrab.current?.id === id) {
			e.currentTarget.releasePointerCapture(e.pointerId);
			rotateGrab.current = null;
		}
		setRotatingId((cur) => (cur === id ? null : cur));
	}, []);

	const tidyRows = useCallback(() => {
		const next: Record<string, CardPos> = {};
		published.forEach((p, i) => { next[p.id] = defaultPos(i); });
		setLayout(next);
		h.showToast('↺ the wall was tidied into rows');
	}, [published, h]);

	const pinIt = useCallback(async () => {
		const placements = published.map((p, i) => {
			const pos = layout[p.id] ?? defaultPos(i);
			return { id: p.id, x: pos.x, y: pos.y, rotation: pos.rotation };
		});
		setSaving(true);
		try {
			await h.arrangeProjects(placements);
		} finally {
			setSaving(false);
		}
	}, [published, layout, h]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
				<span className="footnote">// drag to move · grab the ⤾ corner to tilt · published cards only.</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<span className="chip-dashed" onClick={tidyRows}>↺ tidy into rows</span>
					<button className="btn btn--gold" disabled={saving} onClick={() => void pinIt()}>
						{saving ? 'pinning…' : 'pin it'}
					</button>
				</div>
			</div>

			<div className="project-wall" ref={canvasRef}>
				{published.map((project, index) => {
					const pos = layout[project.id] ?? defaultPos(index);
					const grabbed = grabbedId === project.id;
					const rotating = rotatingId === project.id;
					return (
						<div
							key={project.id}
							className={`wall-card${grabbed || rotating ? ' wall-card--active' : ''}`}
							style={{
								left: `${pos.x}%`, top: `${pos.y}%`,
								'--tilt': `${pos.rotation}deg`,
								zIndex: grabbed || rotating ? 30 : 5 + (index % 4),
							} as React.CSSProperties}
							onPointerDown={(e) => onCardPointerDown(e, project.id)}
							onPointerMove={(e) => onCardPointerMove(e, project.id)}
							onPointerUp={(e) => onCardPointerUp(e, project.id)}
						>
							<div className="wall-card__tack" />
							{project.image && (
								<div className="photo-thumb wall-card__photo">
									<div className="photo-thumb__img wall-card__photo-img" style={{ background: printBackground(h.prints, project.image) }} />
								</div>
							)}
							<span className="wall-card__title">{project.title}</span>
							<div
								className={`wall-card__rotate${rotating ? ' wall-card__rotate--active' : ''}`}
								title="drag to tilt"
								onPointerDown={(e) => onRotatePointerDown(e, project.id)}
								onPointerMove={(e) => onRotatePointerMove(e, project.id)}
								onPointerUp={(e) => onRotatePointerUp(e, project.id)}
							>
								⤾
							</div>
						</div>
					);
				})}
			</div>

			<span className="footnote">// the wall ships to the public site on the next lantern hoist.</span>
		</div>
	);
}
