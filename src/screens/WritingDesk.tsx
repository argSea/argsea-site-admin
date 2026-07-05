// The writing desk. Note CRUD with the draft ⇄ publish pill, peek, and
// confirm-to-burn. Bodies are plain text here; the <p> adapter does the wire.
import { useHarbor } from '../state/harbor';
import type { Note } from '../lib/api';
import { printBackground } from '../lib/prints';

function Row({ note }: { note: Note }) {
	const h = useHarbor();
	const confirmHot = h.confirmKey === `note-${note.id}`;

	return (
		<div className="note-row">
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)', width: 90, flexShrink: 0 }}>
				{note.date || '—'}
			</span>
			{note.image && (
				<div className="photo-thumb">
					<div className="photo-thumb__img" style={{ background: printBackground(h.prints, note.image) }} />
				</div>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
				<span className="row-title" style={{ fontSize: 18 }}>{note.title}</span>
				<span style={{ fontSize: 14, color: 'var(--text-dim)', fontStyle: 'italic' }}>{note.teaser}</span>
			</div>
			<div className="row-actions">
				<span className={`pill ${note.status === 'published' ? 'pill--on' : 'pill--off'}`} onClick={() => h.toggleNoteStatus(note)}>
					{note.status === 'published' ? '● published' : '○ draft'}
				</span>
				<span className="pill pill--quiet" title="preview as it would sail" onClick={() => h.openPeek('note', note.id)}>peek</span>
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

			<div style={{ display: 'flex', flexDirection: 'column', animation: 'fadeUp .7s ease .15s both' }}>
				{h.notes.map((note) => <Row key={note.id} note={note} />)}
			</div>

			<span style={{ fontSize: 15, color: 'var(--text-dim)', fontStyle: 'italic' }}>{blogBarLine}</span>
		</div>
	);
}
