// The writing desk. Note CRUD with the draft ⇄ publish pill, peek, and
// confirm-to-burn. Bodies are plain text here; the <p> adapter does the wire.
// Rows read as journal pages — cream paper, a doodle in the margin, ink
// weather for the day — not the office's usual dark row.
import { useHarbor } from '../state/harbor';
import type { Note } from '../lib/api';
import { ShapeNode } from '../components/ShapeEditor';
import './WritingDesk.css';

function Row({ note }: { note: Note }) {
	const h = useHarbor();
	const confirmHot = h.confirmKey === `note-${note.id}`;
	const doodle = note.doodleId ? h.doodles.find((d) => d.id === note.doodleId) : undefined;
	const inked = note.status === 'published';

	return (
		<div className="journal-row">
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--paper-name)', width: 90, flexShrink: 0 }}>
				{note.date || '—'}
			</span>
			{doodle && (
				<div className="journal-doodle" title={note.doodleCaption || doodle.name}>
					<svg viewBox={doodle.viewBox} width="100%" height="100%" style={{ overflow: 'visible' }}>
						{doodle.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
					</svg>
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
				{note.conditions && (
					<span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic', color: 'rgba(61, 68, 104, .75)' }}>
						{note.conditions}
					</span>
				)}
				<span className="row-title" style={{ fontSize: 18, color: 'var(--paper-name)' }}>{note.title}</span>
				<span style={{ fontSize: 14, color: 'rgba(61, 68, 104, .75)', fontStyle: 'italic' }}>{note.teaser}</span>
			</div>
			<div className="row-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
				<span className={`journal-status ${inked ? 'journal-status--inked' : 'journal-status--pencilled'}`}
					onClick={() => h.toggleNoteStatus(note)}>
					{inked ? '● inked' : '○ pencilled'}
				</span>
				<span className="journal-action" title="preview as it would sail" onClick={() => h.openPeek('note', note.id)}>peek</span>
				<span className="journal-action" onClick={() => h.openEdit('note', note.id)}>edit</span>
				<span className={`journal-action ${confirmHot ? 'journal-action--danger' : ''}`}
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
		: `${published} published. the bar for "blog" is five. ${5 - published} to go — no rush.`;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">the writing desk</span>
					<span className="page-title">Notes</span>
					<span className="page-sub">No schedule. No newsletter. No promises. Just drafts.</span>
				</div>
				<button className="btn" onClick={() => h.openEdit('note', null)}>+ new note</button>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeUp .7s ease .15s both' }}>
				{h.notes.map((note) => <Row key={note.id} note={note} />)}
			</div>

			<span style={{ fontSize: 15, color: 'var(--text-dim)', fontStyle: 'italic' }}>{blogBarLine}</span>
		</div>
	);
}
