// The writing desk. Note CRUD with the draft ⇄ publish pill, peek, and
// confirm-to-burn. Bodies are plain text here; the <p> adapter does the wire.
// Rows are the office's usual flat dark divider row, the shared vocabulary;
// the one paper object left is the doodle chip tucked into the margin.
import { useHarbor } from '../state/harbor';
import type { Note } from '../lib/api';
import { ShapeNode } from '../components/ShapeEditor';
import CatPerch from '../components/CatPerch';
import './WritingDesk.css';

const CAT_QUIPS = ['i am a doodle.', 'caption: cat, from life.', 'press me into an entry. i dare you.'];

function Row({ note }: { note: Note }) {
	const h = useHarbor();
	const confirmHot = h.confirmKey === `note-${note.id}`;
	const doodle = note.doodleId ? h.doodles.find((d) => d.id === note.doodleId) : undefined;
	const inked = note.status === 'published';

	return (
		<div className="note-row">
			<div className="journal-date">
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)' }}>
					{note.date || '–'}
				</span>
				{note.conditions && (
					<span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic', color: 'var(--text-dim)' }}>
						{note.conditions}
					</span>
				)}
			</div>
			{doodle && (
				<div className="journal-doodle" title={note.doodleCaption || doodle.name}>
					<svg viewBox={doodle.viewBox} width="100%" height="100%" style={{ overflow: 'visible' }}>
						{doodle.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
					</svg>
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 220, flex: 1 }}>
				<span className="row-title" style={{ fontSize: 18 }}>{note.title}</span>
				<span style={{ fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic' }}>{note.teaser}</span>
			</div>
			<div className="row-actions">
				<span className={`pill ${inked ? 'pill--on' : 'pill--off'}`} onClick={() => h.toggleNoteStatus(note)}>
					{inked ? '● inked' : '○ pencilled'}
				</span>
				<span className="pill pill--quiet" title="preview as it will look live" onClick={() => h.openPeek('note', note.id)}>peek</span>
				<span className="pill" onClick={() => h.openEdit('note', note.id)}>edit</span>
				<span className={`pill ${confirmHot ? 'pill--danger' : 'pill--quiet'}`}
					onClick={() => h.askConfirm(`note-${note.id}`, () => { void h.burnNote(note); })}>
					{confirmHot ? 'sure? burn it.' : 'burn'}
				</span>
			</div>
		</div>
	);
}

export default function WritingDesk() {
	const h = useHarbor();
	const published = h.notes.filter((n) => n.status === 'published').length;
	const blogBarLine = published >= 5
		? `${published} published. it's officially a blog now. condolences.`
		: `${published} published. the bar for "blog" is five. ${5 - published} to go, no rush.`;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative' }}>
			<CatPerch quips={CAT_QUIPS} style={{ top: -34, right: 202 }} />
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">the writing desk</span>
					<span className="page-title">Notes</span>
					<span className="page-sub">No schedule. No newsletter. No promises. Just drafts.</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('note', null)}>+ new note</button>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 0, animation: 'fadeUp .7s ease .15s both' }}>
				{h.notes.map((note) => <Row key={note.id} note={note} />)}
			</div>

			<span style={{ fontSize: 15, color: 'var(--text-dim)', fontStyle: 'italic' }}>{blogBarLine}</span>
		</div>
	);
}
