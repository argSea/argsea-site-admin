// The darkroom. Drag-drop / click-to-develop uploads, usage badges computed
// from the loaded projects and notes, and delete-with-detach: tearing off a
// print that's still glued to cards warns first, then PUTs the affected
// documents with image: null before deleting the file.
import { useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { MediaItem } from '../lib/api';
import { mediaUrl } from '../lib/api';
import CatPerch from '../components/CatPerch';

const TILE_TILTS = ['-1.2deg', '.9deg', '-.6deg', '1.1deg', '-.9deg', '.7deg'];
const CAT_QUIPS = ['search results: one (1) cat.', 'the query box is warm.', 'filters: fur, whiskers.'];

function Tile({ print, index }: { print: MediaItem; index: number }) {
	const h = useHarbor();
	const usedBy = h.printUsage(print.filename);
	const confirmHot = h.confirmKey === `media-${print.id}`;

	const tearOff = () => {
		if (usedBy && !confirmHot) {
			h.showToast(`⚠ still glued to ${usedBy} card${usedBy > 1 ? 's' : ''}, click again to tear it off`);
		}
		h.askConfirm(`media-${print.id}`, () => { void h.tearOffPrint(print); });
	};

	return (
		<div className="tilt hover-still" style={{
			'--tilt': TILE_TILTS[index % 6],
			position: 'relative', background: 'var(--paper)', borderRadius: 4, padding: '10px 10px 6px',
			boxShadow: '0 10px 24px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column',
		} as React.CSSProperties}>
			<div style={{ height: 120, borderRadius: 2, background: `url("${mediaUrl(print.url)}") center/cover` }} />
			{usedBy > 0 && (
				<span style={{
					position: 'absolute', top: 16, left: 16, background: 'rgba(19,23,40,.85)',
					border: '1px solid var(--gold-dash)', borderRadius: 999, padding: '3px 9px',
					fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--gold)',
				}}>on {usedBy} card{usedBy > 1 ? 's' : ''}</span>
			)}
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 4px 4px' }}>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--paper-name)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
					{print.filename}
				</span>
				<span className="print-del" onClick={tearOff}>{confirmHot ? 'sure?' : '✕'}</span>
			</div>
		</div>
	);
}

export default function Darkroom() {
	const h = useHarbor();
	const [dragging, setDragging] = useState(false);
	const [q, setQ] = useState('');
	const fileInput = useRef<HTMLInputElement>(null);

	const drop = (event: DragEvent) => {
		event.preventDefault();
		setDragging(false);
		void h.developPrints(event.dataTransfer?.files ?? []);
	};

	const query = q.trim().toLowerCase();
	const tiles = query ? h.prints.filter((print) => print.filename.toLowerCase().includes(query)) : h.prints;
	const countLine = query
		? `${tiles.length} of ${h.prints.length} prints match.`
		: `${h.prints.length} prints hanging to dry.`;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">the darkroom</span>
					<span className="page-title">Prints &amp; scans</span>
					<span className="page-sub">{countLine} Handle by the edges.</span>
				</div>
				<span style={{ position: 'relative', flex: '0 1 240px', display: 'inline-flex' }}>
					<CatPerch quips={CAT_QUIPS} pose="lying" style={{ top: -36, right: 14 }} />
					<input type="text" className="input" style={{ borderRadius: 999, padding: '10px 16px', fontSize: 12.5 }}
						placeholder="search the prints..." value={q} onChange={(e) => setQ(e.target.value)} />
				</span>
				<button className="btn" onClick={() => fileInput.current?.click()}>+ develop a print</button>
				<input type="file" accept="image/*" multiple ref={fileInput} style={{ display: 'none' }}
					onChange={(e) => { void h.developPrints(e.target.files ?? []); e.target.value = ''; }} />
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 20, animation: 'fadeUp .7s ease .15s both' }}>
				<div onClick={() => fileInput.current?.click()}
					onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
					onDragLeave={() => setDragging(false)}
					onDrop={drop}
					style={{
						minHeight: 158, borderRadius: 4, boxSizing: 'border-box', cursor: 'pointer',
						border: dragging ? '1.5px dashed rgba(240,217,168,.9)' : '1.5px dashed rgba(147,160,232,.4)',
						background: dragging ? 'rgba(240,217,168,.07)' : 'rgba(147,160,232,.04)',
						display: 'flex', alignItems: 'center', justifyContent: 'center',
						transition: 'border-color .2s, background .2s',
					}}>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle)', textAlign: 'center', lineHeight: 1.8, pointerEvents: 'none' }}>
						drop a photo here<br />or click to develop
					</span>
				</div>

				{tiles.map((print, index) => (
					<Tile key={print.id} print={print} index={index} />
				))}
			</div>

			{query && tiles.length === 0 && (
				<span className="footnote" style={{ fontStyle: 'italic' }}>nothing in the darkroom matches.</span>
			)}

			<span className="footnote">// originals live in the media store. these are the harbor copies.</span>
		</div>
	);
}
