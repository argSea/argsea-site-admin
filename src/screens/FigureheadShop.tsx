// The Figurehead Shop. The carver's bench for the harbor cat: a version shelf
// per pose, and behind any design the touch-first SVG editor. Designs are
// documents; saves are explicit, nothing here rides the copy autosave.
import { useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { FigureheadDesign, FigureheadPose } from '../lib/api';
import { relativeTime } from '../lib/time';
import ShapeEditor, { ShapeNode } from '../components/ShapeEditor';
import type { EditorDoc } from '../components/ShapeEditor';
import './FigureheadShop.css';

const POSES: { pose: FigureheadPose; title: string; blurb: string; viewBox: string }[] = [
	{ pose: 'perched', title: 'Perched', blurb: 'front paws on an edge, tail swaying over the side', viewBox: '0 0 64 74' },
	{ pose: 'lying', title: 'Lying', blurb: 'loafed along a horizontal, tail draped off the rump', viewBox: '0 0 100 48' },
];

// shelf order: the published design leads its pose, the rest by recency
const byShelf = (a: FigureheadDesign, b: FigureheadDesign): number =>
	Number(b.published) - Number(a.published) || b.updatedAt.localeCompare(a.updatedAt);

function ShelfRow({ d, onOpen, onCopy }: { d: FigureheadDesign; onOpen: () => void; onCopy: () => void }) {
	const h = useHarbor();
	const [renaming, setRenaming] = useState(false);
	const publishKey = `publish-${d.id}`;
	const current = h.designs.find((x) => x.pose === d.pose && x.published);
	const deleteBar = d.seed
		? 'a seed is carved, it stays'
		: d.published ? 'lower it before scrapping it, publish another first' : null;

	const commitRename = (value: string) => {
		setRenaming(false);
		void h.renameDesign(d, value);
	};

	return (
		<div className="shelf-row">
			<div className="shelf-row__peek" aria-hidden="true">
				<svg viewBox={d.viewBox} width="64" height="48" style={{ overflow: 'visible' }}>
					{d.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
				</svg>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 150 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
					{renaming ? (
						<input type="text" className="input input--display" autoFocus defaultValue={d.label}
							aria-label="design label"
							style={{ width: 200, padding: '6px 10px', fontSize: 17 }}
							onBlur={(e) => commitRename(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === 'Enter') {
									commitRename(e.currentTarget.value);
								} else if (e.key === 'Escape') {
									setRenaming(false);
								}
							}} />
					) : (
						<span className="row-title" style={{ fontSize: 18 }}>{d.label}</span>
					)}
					{d.published && <span className="egg-status egg-status--loose">published</span>}
					{d.seed && <span className="egg-status" title="seeded v1: immutable, so the shop can always fall back to it">seed</span>}
				</div>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
					{d.shapes.length} shape{d.shapes.length === 1 ? '' : 's'} · updated {relativeTime(d.updatedAt)}
				</span>
			</div>

			<div className="row-actions">
				<button type="button" className="pill" onClick={onOpen}>open</button>
				<button type="button" className="pill pill--quiet" title="copy it onto a fresh draft, the correct-v2 loop" onClick={onCopy}>
					open as new draft
				</button>
				{!d.seed && (
					<button type="button" className="pill pill--quiet" onClick={() => setRenaming(true)}>rename</button>
				)}
				{!d.published && (
					<button type="button" className="chip-dashed"
						style={h.confirmKey === publishKey ? { borderColor: 'var(--gold-dash-hot)' } : undefined}
						onClick={() => h.askConfirm(publishKey, () => void h.publishDesign(d))}>
						{h.confirmKey === publishKey
							? `replaces ${current?.label ?? 'nothing'} as the ${d.pose} cat on next hoist, sure?`
							: 'publish'}
					</button>
				)}
				<button type="button" className="cove-x" disabled={Boolean(deleteBar)}
					title={deleteBar ?? 'scrap this design'}
					style={deleteBar ? { opacity: .4, cursor: 'default' } : undefined}
					onClick={() => h.askConfirm(`scrap-${d.id}`, () => void h.deleteDesign(d))}>
					{h.confirmKey === `scrap-${d.id}` ? '!' : '✕'}
				</button>
			</div>
		</div>
	);
}

export default function FigureheadShop() {
	const h = useHarbor();
	const [editing, setEditing] = useState<EditorDoc | null>(null);

	const openDesign = (d: FigureheadDesign) => setEditing({
		id: d.id, pose: d.pose, label: d.label, viewBox: d.viewBox,
		shapes: structuredClone(d.shapes), published: d.published, seed: d.seed,
	});

	const copyDesign = (d: FigureheadDesign) => setEditing({
		id: null, pose: d.pose, label: `${d.label} refit`, viewBox: d.viewBox,
		shapes: structuredClone(d.shapes), published: false, seed: false,
	});

	const freshDraft = (pose: FigureheadPose, viewBox: string) => setEditing({
		id: null, pose, label: 'untitled figurehead', viewBox, shapes: [], published: false, seed: false,
	});

	if (editing) {
		return <ShapeEditor doc={editing} onClose={() => setEditing(null)} />;
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">at the bow</span>
				<span className="page-title">The Figurehead Shop</span>
				<span className="page-sub">Where the harbor cat gets carved. Draft freely; the site only takes the published design of each pose, and only on the next hoist.</span>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .7s ease .15s both' }}>
				{POSES.map((pose) => {
					const rack = h.designs.filter((d) => d.pose === pose.pose).sort(byShelf);
					return (
						<div key={pose.pose} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
							<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
								<div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
									<span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-strong)' }}>{pose.title}</span>
									<span style={{ fontSize: 14, color: 'var(--text-body)', fontStyle: 'italic' }}>{pose.blurb}</span>
								</div>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
									{rack.length} on the shelf · one on the bow
								</span>
							</div>

							<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
								{rack.map((d) => (
									<ShelfRow key={d.id} d={d} onOpen={() => openDesign(d)} onCopy={() => copyDesign(d)} />
								))}
								{rack.length === 0 && (
									<span className="row-sub" style={{ fontStyle: 'italic' }}>bare shelf, the seeds should be along any moment.</span>
								)}
							</div>

							<button type="button" className="cove-add" onClick={() => freshDraft(pose.pose, pose.viewBox)}>
								+ carve a fresh blank
							</button>
						</div>
					);
				})}
			</div>

			<span className="footnote">// exactly one design per pose is live; publishing swaps it on the next lantern hoist.</span>
		</div>
	);
}
