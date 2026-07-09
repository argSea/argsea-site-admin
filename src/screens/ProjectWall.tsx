// The coast: drag published lights along a night band, then pin the
// arrangement. Positions are stored as percentages (x along the shore, y
// elevation within the band), the same coordinate model WallPos already
// used. Rotation is a legacy postcard-wall tilt; the coast never edits it,
// it just rides through on save. Order has no place here: the rack rows own
// register order, this tab is placement only.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { Project } from '../lib/api';
import { DEFAULT_LIGHT } from '../lib/lightChar';
import Lamp from '../components/Lamp';
import './ProjectWall.css';

interface CardPos { x: number; y: number }

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// spreads a fresh light evenly along the shore, staggered in elevation so a
// straight run of lamps doesn't land in a dead flat line
const ROW_Y = [40, 62, 30, 70, 48, 56];

function defaultPos(i: number, total: number): CardPos {
	const x = total > 1 ? 8 + (84 * i) / (total - 1) : 50;
	return { x, y: ROW_Y[i % ROW_Y.length] };
}

function initialLayout(published: Project[]): Record<string, CardPos> {
	const layout: Record<string, CardPos> = {};
	published.forEach((p, i) => {
		layout[p.id] = p.wallPos ? { x: p.wallPos.x, y: p.wallPos.y } : defaultPos(i, published.length);
	});
	return layout;
}

export default function ProjectWall() {
	const h = useHarbor();
	const published = useMemo(() => h.projects.filter((p) => p.status === 'published'), [h.projects]);
	const publishedKey = published.map((p) => p.id).join('|');

	const [layout, setLayout] = useState<Record<string, CardPos>>(() => initialLayout(published));
	const [grabbedId, setGrabbedId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const canvasRef = useRef<HTMLDivElement>(null);
	const dragId = useRef<string | null>(null);

	// a newly-published light joins the coast seeded into the default spread;
	// existing placements (saved or mid-drag) are left alone
	useEffect(() => {
		setLayout((cur) => {
			let changed = false;
			const next = { ...cur };
			published.forEach((p, i) => {
				if (!next[p.id]) {
					next[p.id] = p.wallPos ? { x: p.wallPos.x, y: p.wallPos.y } : defaultPos(i, published.length);
					changed = true;
				}
			});
			return changed ? next : cur;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [publishedKey]);

	const posFromPointer = useCallback((e: React.PointerEvent): CardPos | null => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return null;
		}
		const rect = canvas.getBoundingClientRect();
		return {
			x: clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100),
			y: clamp(((e.clientY - rect.top) / rect.height) * 100, 0, 100),
		};
	}, []);

	const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		e.currentTarget.setPointerCapture(e.pointerId);
		dragId.current = id;
		setGrabbedId(id);
	}, []);

	const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		if (dragId.current !== id) {
			return;
		}
		const pos = posFromPointer(e);
		if (pos) {
			setLayout((cur) => ({ ...cur, [id]: pos }));
		}
	}, [posFromPointer]);

	const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>, id: string) => {
		if (dragId.current === id) {
			e.currentTarget.releasePointerCapture(e.pointerId);
			dragId.current = null;
		}
		setGrabbedId((cur) => (cur === id ? null : cur));
	}, []);

	const tidyRows = useCallback(() => {
		const next: Record<string, CardPos> = {};
		published.forEach((p, i) => { next[p.id] = defaultPos(i, published.length); });
		setLayout(next);
		h.showToast('↺ the coast was tidied into a row');
	}, [published, h]);

	const pinIt = useCallback(async () => {
		const placements = published.map((p, i) => {
			const pos = layout[p.id] ?? defaultPos(i, published.length);
			// rotation is a legacy postcard-wall tilt the coast doesn't edit; it
			// just rides through so the field never gets clobbered to 0
			return { id: p.id, x: pos.x, y: pos.y, rotation: p.wallPos?.rotation ?? 0 };
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
				<span className="footnote">// drag a light along the coast · the register order lives on the rack</span>
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<span className="chip-dashed" onClick={tidyRows}>↺ tidy into rows</span>
					<button className="btn btn--gold" disabled={saving} onClick={() => void pinIt()}>
						{saving ? 'pinning…' : 'pin it'}
					</button>
				</div>
			</div>

			<div className="coast-canvas" ref={canvasRef}>
				{published.map((project) => {
					const pos = layout[project.id] ?? defaultPos(0, 1);
					const grabbed = grabbedId === project.id;
					const light = project.light ?? DEFAULT_LIGHT;
					return (
						<div
							key={project.id}
							className={`coast-lamp${grabbed ? ' coast-lamp--active' : ''}`}
							style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
							onPointerDown={(e) => onPointerDown(e, project.id)}
							onPointerMove={(e) => onPointerMove(e, project.id)}
							onPointerUp={(e) => onPointerUp(e, project.id)}
						>
							<Lamp light={light} size={12} haloScale={3.6} />
							<span className="coast-lamp__title">{project.title}</span>
						</div>
					);
				})}
			</div>

			<span className="footnote">// the coast ships to the public site on the next lantern hoist.</span>
		</div>
	);
}
