// The papers. A shelf of stored resume cuts rather than one file that gets
// overwritten: each carries a title and the keeper's own notes, exactly one is
// published, and any of them opens for comparison. The pdf is immutable once
// filed, so a row edits its title and notes and nothing else. The filing panel
// copies the darkroom's upload shape (hidden input behind a button), with the
// title and notes riding along because the record and its pdf are stored in one
// call. Scrapping the live cut is left to the API to refuse, not guarded here.
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { Resume } from '../lib/api';
import { mediaUrl } from '../lib/api';
import { relativeTime } from '../lib/time';
import CatPerch from '../components/CatPerch';

const CAT_QUIPS = ['references available: me.', 'i have read none of these.', 'the notes are for you, not them.'];

const byRecent = (a: Resume, b: Resume): number => b.createdAt.localeCompare(a.createdAt);

function Cut({ cut }: { cut: Resume }) {
	const h = useHarbor();
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState(cut.title);
	const [notes, setNotes] = useState(cut.notes);
	const scrapKey = `scrap-cut-${cut.id}`;

	const scribble = () => {
		setTitle(cut.title);
		setNotes(cut.notes);
		setEditing(true);
	};

	const keep = () => {
		void h.editResume(cut, title, notes).then((kept) => {
			if (kept) {
				setEditing(false);
			}
		});
	};

	return (
		<div className={`content-row${cut.published ? ' content-row--gold' : ' content-row--alt'}`}>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, flex: '1 1 260px' }}>
				{editing ? (
					<>
						<input type="text" className="input input--display" autoFocus aria-label="the cut's title"
							value={title} onChange={(e) => setTitle(e.target.value)} />
						<span className="footnote">filed {relativeTime(cut.createdAt)} · {cut.filename}</span>
						<textarea className="input" rows={3} aria-label="the cut's notes"
							value={notes} onChange={(e) => setNotes(e.target.value)} />
					</>
				) : (
					<>
						<span className="row-title">{cut.title}</span>
						<span className="footnote">filed {relativeTime(cut.createdAt)} · {cut.filename}</span>
						{cut.notes
							? <span className="row-sub" style={{ whiteSpace: 'pre-wrap' }}>{cut.notes}</span>
							: <span className="row-sub" style={{ fontStyle: 'italic' }}>no notes on this cut.</span>}
					</>
				)}
			</div>

			<div className="row-actions">
				{editing ? (
					<>
						<button type="button" className="pill" onClick={keep}>keep the changes</button>
						<button type="button" className="pill pill--quiet" onClick={() => setEditing(false)}>never mind</button>
					</>
				) : (
					<>
						{cut.published
							? <button type="button" className="pill pill--on" onClick={() => void h.unpublishResume(cut)}>◍ the live cut · take it down</button>
							: <button type="button" className="pill" onClick={() => void h.publishResume(cut)}>send this one out</button>}
						<a className="pill pill--quiet" href={mediaUrl(cut.url)} target="_blank" rel="noreferrer">read it</a>
						<button type="button" className="pill pill--quiet" onClick={scribble}>scribble on it</button>
						{/* the live cut keeps its ✕: the API refuses that delete with a 409
						    naming the remedy, and the remedy is the control beside it */}
						<button type="button" className="cove-x" title="off the shelf"
							onClick={() => h.askConfirm(scrapKey, () => void h.scrapResume(cut))}>
							{h.confirmKey === scrapKey ? '!' : '✕'}
						</button>
					</>
				)}
			</div>
		</div>
	);
}

export default function Papers() {
	const h = useHarbor();
	const [title, setTitle] = useState('');
	const [notes, setNotes] = useState('');
	const [pdf, setPdf] = useState<File | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);

	const cuts = [...h.resumes].sort(byRecent);
	const live = cuts.find((cut) => cut.published);

	const file = (event: FormEvent) => {
		event.preventDefault();
		const name = title.trim();
		if (!pdf) {
			h.showToast('pick a pdf first; the shelf holds papers, not titles');
			return;
		}
		if (!name) {
			h.showToast('give the cut a title, or you will never tell them apart');
			return;
		}
		void h.fileResume(pdf, name, notes).then((filed) => {
			if (!filed) {
				return;
			}
			setTitle('');
			setNotes('');
			setPdf(null);
		});
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">ashore</span>
				<span className="page-title">The papers</span>
				<span className="page-sub">
					{cuts.length} cut{1 === cuts.length ? '' : 's'} on the shelf · {live ? `"${live.title}" is out there` : 'nothing is out there'}.
					Keep a cut per berth you are after and send out the one that fits.
				</span>
			</div>

			<form className="card" onSubmit={file}
				style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, margin: 0, animation: 'fadeUp .7s ease .15s both' }}>
				<CatPerch quips={CAT_QUIPS} style={{ top: -58, right: 26 }} />
				<span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-strong)' }}>file a fresh cut</span>

				<label className="field">
					<span className="field-label">which cut is this</span>
					<input type="text" className="input" placeholder="systems architect, long form"
						value={title} onChange={(e) => setTitle(e.target.value)} />
				</label>

				<label className="field">
					<span className="field-label">notes, for you only</span>
					<textarea className="input" rows={3} placeholder="what this cut leans on, and who it went to..."
						value={notes} onChange={(e) => setNotes(e.target.value)} />
				</label>

				<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
					<button type="button" className="dash-add" onClick={() => fileInput.current?.click()}>
						{pdf ? `↻ ${pdf.name}` : '+ pick the pdf'}
					</button>
					<input type="file" accept="application/pdf" ref={fileInput} style={{ display: 'none' }}
						onChange={(e) => { setPdf(e.target.files?.[0] ?? null); e.target.value = ''; }} />
					<button type="submit" className="btn btn--gold">file it on the shelf</button>
				</div>
			</form>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fadeUp .7s ease .25s both' }}>
				{cuts.map((cut) => <Cut key={cut.id} cut={cut} />)}
				{0 === cuts.length && (
					<span className="row-sub" style={{ fontStyle: 'italic' }}>a bare shelf. file the first cut.</span>
				)}
			</div>

			<span className="footnote">// the notes never leave this room. the pdf is what goes ashore.</span>
		</div>
	);
}
