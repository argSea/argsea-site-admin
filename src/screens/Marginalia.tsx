// Marginalia: the doodle desk. A grid of saved sketches, and behind any of
// them the pen+pencil editor. Modeled on the figurehead shop's shelf, minus
// the pose racks and lifecycle chrome a doodle doesn't have.
import { useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { Doodle } from '../lib/api';
import { relativeTime } from '../lib/time';
import { ShapeNode } from '../components/ShapeEditor';
import DoodleEditor from '../components/DoodleEditor';
import type { DoodleEditorDoc } from '../components/DoodleEditor';
import CatPerch from '../components/CatPerch';
import './Marginalia.css';

const DOODLE_VIEWBOX = '0 0 100 100';
const CAT_QUIPS = ['the inks are guarded.', 'draw around me.', 'i drank the periwinkle. it was fine.'];

const byRecent = (a: Doodle, b: Doodle): number => b.updatedAt.localeCompare(a.updatedAt);

function DoodleCard({ d, onOpen }: { d: Doodle; onOpen: () => void }) {
	const h = useHarbor();
	const [renaming, setRenaming] = useState(false);
	const scrapKey = `scrap-doodle-${d.id}`;

	const commitRename = (value: string) => {
		setRenaming(false);
		void h.renameDoodle(d, value);
	};

	return (
		<div className="card card--alt doodle-card" onClick={onOpen}>
			<div className="doodle-card__peek" aria-hidden="true">
				<svg viewBox={d.viewBox} width="100%" height="100%" style={{ overflow: 'visible' }}>
					{d.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
				</svg>
			</div>

			{renaming ? (
				<input type="text" className="input input--display" autoFocus defaultValue={d.name}
					aria-label="doodle name" style={{ padding: '6px 10px', fontSize: 14 }}
					onClick={(e) => e.stopPropagation()}
					onBlur={(e) => commitRename(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							commitRename(e.currentTarget.value);
						} else if (e.key === 'Escape') {
							setRenaming(false);
						}
					}} />
			) : (
				<span className="doodle-card__name">{d.name}</span>
			)}
			<span className="doodle-card__meta">updated {relativeTime(d.updatedAt)}</span>

			<div className="doodle-card__actions" onClick={(e) => e.stopPropagation()}>
				<button type="button" className="pill pill--quiet" onClick={() => setRenaming(true)}>rename</button>
				<button type="button" className="cove-x"
					style={{ marginLeft: 'auto' }}
					title="scrap this doodle"
					onClick={() => h.askConfirm(scrapKey, () => void h.deleteDoodle(d))}>
					{h.confirmKey === scrapKey ? '!' : '✕'}
				</button>
			</div>
		</div>
	);
}

export default function Marginalia() {
	const h = useHarbor();
	const [editing, setEditing] = useState<DoodleEditorDoc | null>(null);

	const openDoodle = (d: Doodle) => setEditing({
		id: d.id, name: d.name, viewBox: d.viewBox, shapes: structuredClone(d.shapes),
	});

	const freshDoodle = () => setEditing({ id: null, name: 'untitled doodle', viewBox: DOODLE_VIEWBOX, shapes: [] });

	if (editing) {
		return <DoodleEditor doc={editing} onClose={() => setEditing(null)} />;
	}

	const doodles = [...h.doodles].sort(byRecent);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">at the desk</span>
				<span className="page-title">Marginalia</span>
				<span className="page-sub">Quick sketches for the margins of a journal entry. Draw freely; attaching one to a note comes later.</span>
			</div>

			<div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .7s ease .15s both' }}>
				<div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
					<CatPerch quips={CAT_QUIPS} style={{ top: -58, right: 26 }} />
					<span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-strong)' }}>the desk</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
						{doodles.length} sketch{doodles.length === 1 ? '' : 'es'}
					</span>
				</div>

				<div className="doodle-shelf">
					{doodles.map((d) => <DoodleCard key={d.id} d={d} onOpen={() => openDoodle(d)} />)}
				</div>
				{doodles.length === 0 && (
					<span className="row-sub" style={{ fontStyle: 'italic' }}>a bare desk, sketch something.</span>
				)}

				<button type="button" className="cove-add" onClick={freshDoodle}>
					+ a fresh page
				</button>
			</div>

			<span className="footnote">// doodles here are loose pages; attaching one to a journal entry is a later trip to the desk.</span>
		</div>
	);
}
