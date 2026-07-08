// The edit overlay: postcard, headstone, and note forms, the stamp designer,
// the photo-print picker, and the earlier-printings (revisions) section.
// "File it" on a restored draft goes through the restore endpoint — that's
// the server copy-forward that makes status travel with the printing.
import { useHarbor } from '../state/harbor';
import type { EditState, HobbyDraft, NoteDraft, ProjectDraft } from '../state/harbor';
import type { Category, Stamp as StampData } from '../lib/api';
import { INKS, MOTIF_IDS, POSTMARK_TEXTS, STAMP_TEXT_MAX, DEFAULT_STAMP, randomStamp } from '../lib/stamp';
import { printBackground } from '../lib/prints';
import { relativeTime } from '../lib/time';
import Stamp from './Stamp';
import { ShapeNode } from './ShapeEditor';

const CATEGORIES: Category[] = ['backend', 'games', 'this website', 'tinkering'];

const KICKERS: Record<EditState['type'], string> = {
	project: 'postcard · ',
	hobby:   'headstone · ',
	note:    'note · ',
};

function DesignerChip({ selected, label, onClick }: { selected: boolean; label: string; onClick: () => void }) {
	return (
		<span onClick={onClick} style={{
			padding: '6px 13px', borderRadius: 999, fontFamily: 'var(--font-mono)', fontSize: 11.5,
			cursor: 'pointer', userSelect: 'none', transition: 'all .2s',
			border: selected ? '1.5px dashed var(--gold-dash-hot)' : '1px solid var(--border-chip)',
			color: selected ? 'var(--gold)' : 'var(--text-body)',
		}}>{label}</span>
	);
}

function StampDesigner({ draft }: { draft: ProjectDraft }) {
	const h = useHarbor();
	// an untouched empty stamp shows the default; any chip press makes it real
	const stamp = draft.stamp ?? DEFAULT_STAMP;
	const set = (patch: Partial<StampData>) => h.patchStamp({ ...stamp, ...patch });

	return (
		<div className="fieldset-dashed" style={{ gap: 14 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the stamp · top-right corner</span>
				<span className="chip-dashed" onClick={() => h.patchStamp(randomStamp())}>⚄ surprise me</span>
			</div>
			<div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
				<div style={{
					width: 96, height: 96, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
					background: 'var(--well)', border: '1px solid var(--border-input)', borderRadius: 8,
				}}>
					<Stamp stamp={stamp} scale={1.5} />
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 9, flex: 1, minWidth: 230 }}>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						<DesignerChip selected={stamp.shape === 'rect'} label="stamp"
							onClick={() => set({ shape: 'rect', cents: stamp.cents || '3¢' })} />
						<DesignerChip selected={stamp.shape === 'circle'} label="postmark"
							onClick={() => set({ shape: 'circle' })} />
						{INKS.map((ink) => (
							<DesignerChip key={ink} selected={stamp.ink === ink}
								label={ink === '#f0d9a8' ? 'gold ink' : 'periwinkle ink'}
								onClick={() => set({ ink })} />
						))}
					</div>
					<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
						{[...MOTIF_IDS, 'text' as const].map((motif) => (
							<DesignerChip key={motif} selected={stamp.motif === motif}
								label={motif === 'text' ? 'words' : motif}
								onClick={() => set(motif === 'text' ? { motif, text: stamp.text || POSTMARK_TEXTS[1] } : { motif })} />
						))}
					</div>
					{stamp.motif === 'text' && (
						<input type="text" className="input" placeholder="AIR MAIL" maxLength={STAMP_TEXT_MAX}
							value={stamp.text ?? ''}
							onChange={(e) => set({ text: e.target.value })}
							style={{ padding: '9px 12px', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-soft)' }} />
					)}
				</div>
			</div>
		</div>
	);
}

function PrintPicker({ selected, kind }: { selected: string | null; kind: 'card' | 'note' }) {
	const h = useHarbor();
	const options: { name: string; image: string | null }[] =
		[{ name: 'no print', image: null }, ...h.prints.map((p) => ({ name: p.filename, image: p.filename }))];

	return (
		<div className="fieldset-dashed">
			<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
				the photo print · one per {kind}
			</span>
			<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
				{options.map((option) => (
					<div key={option.name} onClick={() => h.patchDraft({ image: option.image })} style={{
						display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', cursor: 'pointer',
						background: 'var(--paper)', borderRadius: 4, padding: '6px 6px 5px',
						transform: selected === option.image ? 'rotate(0deg)' : 'rotate(-1.2deg)',
						transition: 'transform .2s, outline-color .2s',
						outline: selected === option.image ? '2px dashed rgba(240,217,168,.9)' : '2px dashed transparent',
						outlineOffset: 3,
					}}>
						<div style={option.image
							? { width: 64, height: 48, borderRadius: 2, background: printBackground(h.prints, option.image) }
							: { width: 64, height: 48, borderRadius: 2, background: 'var(--well)', border: '1px dashed rgba(95,110,196,.5)', boxSizing: 'border-box' }} />
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--paper-name)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{option.name}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function DoodlePicker({ selected }: { selected: string | null }) {
	const h = useHarbor();

	return (
		<div className="fieldset-dashed">
			<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
				the doodle · one per note
			</span>
			<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
				<div onClick={() => h.patchDraft({ doodleId: null })} style={{
					display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', cursor: 'pointer',
					background: 'var(--paper)', borderRadius: 4, padding: '6px 6px 5px',
					transform: selected === null ? 'rotate(0deg)' : 'rotate(-1.2deg)',
					transition: 'transform .2s, outline-color .2s',
					outline: selected === null ? '2px dashed rgba(240,217,168,.9)' : '2px dashed transparent',
					outlineOffset: 3,
				}}>
					<div style={{ width: 64, height: 48, borderRadius: 2, background: 'var(--well)', border: '1px dashed rgba(95,110,196,.5)', boxSizing: 'border-box' }} />
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--paper-name)' }}>none</span>
				</div>
				{h.doodles.map((d) => (
					<div key={d.id} onClick={() => h.patchDraft({ doodleId: d.id })} style={{
						display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', cursor: 'pointer',
						background: 'var(--paper)', borderRadius: 4, padding: '6px 6px 5px',
						transform: selected === d.id ? 'rotate(0deg)' : 'rotate(-1.2deg)',
						transition: 'transform .2s, outline-color .2s',
						outline: selected === d.id ? '2px dashed rgba(240,217,168,.9)' : '2px dashed transparent',
						outlineOffset: 3,
					}}>
						<div style={{ width: 64, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							<svg viewBox={d.viewBox} width="100%" height="100%" style={{ overflow: 'visible' }}>
								{d.shapes.map((s) => <ShapeNode key={s.id} s={s} />)}
							</svg>
						</div>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--paper-name)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{d.name}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

function ProjectFields({ draft }: { draft: ProjectDraft }) {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<label className="field">
				<span className="field-label">title</span>
				<input type="text" className="input input--display" value={draft.title}
					onChange={(e) => h.patchDraft({ title: e.target.value })} />
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">berth (category)</span>
					<select className="input" value={draft.category}
						onChange={(e) => h.patchDraft({ category: e.target.value as Category })}>
						{CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
					</select>
				</label>
				<label className="field">
					<span className="field-label">tags · comma separated</span>
					<input type="text" className="input" style={{ color: 'var(--periwinkle)' }} value={draft.tagsText}
						onChange={(e) => h.patchDraft({ tagsText: e.target.value })} />
				</label>
			</div>
			<label className="field">
				<span className="field-label">front of card · short description</span>
				<textarea className="input input--serif" rows={2} value={draft.shortDesc}
					onChange={(e) => h.patchDraft({ shortDesc: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">back of card · the full story</span>
				<textarea className="input input--serif" rows={6} value={draft.bodyText}
					placeholder="the long version — what happened, what broke, what you'd do differently. renders when a card is flipped over."
					style={{ padding: '13px 14px', fontSize: 15.5, lineHeight: 1.65 }}
					onChange={(e) => h.patchDraft({ bodyText: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">moral of the story</span>
				<input type="text" className="input input--serif-italic" value={draft.moral}
					onChange={(e) => h.patchDraft({ moral: e.target.value })} />
			</label>
			<div className="fieldset-dashed">
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the address block</span>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
					<label className="field">
						<span className="field-label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>to:</span>
						<input type="text" className="input input--soft" style={{ padding: '9px 12px' }} value={draft.postcardTo}
							onChange={(e) => h.patchDraft({ postcardTo: e.target.value })} />
					</label>
					<label className="field">
						<span className="field-label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>from:</span>
						<input type="text" className="input input--soft" style={{ padding: '9px 12px' }} value={draft.postcardFrom}
							onChange={(e) => h.patchDraft({ postcardFrom: e.target.value })} />
					</label>
					<label className="field">
						<span className="field-label" style={{ textTransform: 'none', letterSpacing: 'normal' }}>postmarked:</span>
						<input type="text" className="input input--soft" style={{ padding: '9px 12px' }} value={draft.postmarked}
							onChange={(e) => h.patchDraft({ postmarked: e.target.value })} />
					</label>
				</div>
			</div>
			<StampDesigner draft={draft} />
			<PrintPicker selected={draft.image} kind="card" />
		</div>
	);
}

function HobbyFields({ draft }: { draft: HobbyDraft }) {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">hobby</span>
					<input type="text" className="input input--display" value={draft.name}
						onChange={(e) => h.patchDraft({ name: e.target.value })} />
				</label>
				<label className="field">
					<span className="field-label">dates</span>
					<input type="text" className="input input--soft" style={{ padding: '11px 13px', fontSize: 13 }} value={draft.dates}
						onChange={(e) => h.patchDraft({ dates: e.target.value })} />
				</label>
			</div>
			<label className="field">
				<span className="field-label">epitaph · shows on the headstone</span>
				<input type="text" className="input input--soft" style={{ padding: '11px 13px', fontSize: 13 }} placeholder="† it was a phase"
					value={draft.epitaph} onChange={(e) => h.patchDraft({ epitaph: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">eulogy</span>
				<textarea className="input input--serif" rows={3} value={draft.eulogy}
					onChange={(e) => h.patchDraft({ eulogy: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">tags · comma separated</span>
				<input type="text" className="input" style={{ color: 'var(--periwinkle)' }} value={draft.tagsText}
					onChange={(e) => h.patchDraft({ tagsText: e.target.value })} />
			</label>
		</div>
	);
}

function NoteFields({ draft }: { draft: NoteDraft }) {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">title</span>
					<input type="text" className="input input--display" value={draft.title}
						onChange={(e) => h.patchDraft({ title: e.target.value })} />
				</label>
				<label className="field">
					<span className="field-label">date</span>
					<input type="text" className="input input--soft" style={{ padding: '11px 13px', fontSize: 13 }} value={draft.date}
						onChange={(e) => h.patchDraft({ date: e.target.value })} />
				</label>
			</div>
			<label className="field">
				<span className="field-label">teaser · one line</span>
				<input type="text" className="input input--serif-italic" value={draft.teaser}
					onChange={(e) => h.patchDraft({ teaser: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">conditions · the day's weather</span>
				<input type="text" className="input input--soft" style={{ padding: '11px 13px', fontSize: 13 }}
					placeholder="squally, low visibility" value={draft.conditions}
					onChange={(e) => h.patchDraft({ conditions: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">the note itself</span>
				<textarea className="input input--serif" rows={9} value={draft.bodyText}
					style={{ padding: '13px 14px', fontSize: 15.5, lineHeight: 1.65 }}
					onChange={(e) => h.patchDraft({ bodyText: e.target.value })} />
			</label>
			<DoodlePicker selected={draft.doodleId} />
			<label className="field">
				<span className="field-label">doodle caption</span>
				<input type="text" className="input input--soft" style={{ padding: '11px 13px', fontSize: 13 }}
					value={draft.doodleCaption} onChange={(e) => h.patchDraft({ doodleCaption: e.target.value })} />
			</label>
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
				— signs itself "{h.keeper.signoff || '— j'}" on the way out
			</span>
		</div>
	);
}

export default function EditOverlay() {
	const h = useHarbor();
	const edit = h.edit;
	if (!edit) {
		return null;
	}

	return (
		<div className="overlay-backdrop" style={{ zIndex: 50 }} onClick={h.cancelEdit}>
			<div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{
				width: 'min(680px, 100%)', padding: 'clamp(22px, 4vw, 34px)',
				display: 'flex', flexDirection: 'column', gap: 16,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
					<span className="card-kicker" style={{ letterSpacing: '.14em' }}>
						{KICKERS[edit.type]}{edit.id === null ? 'a fresh one' : 'editing'}
					</span>
					<span className="pill" onClick={h.cancelEdit}>close ✕</span>
				</div>

				{edit.type === 'project' && <ProjectFields draft={edit.draft} />}
				{edit.type === 'hobby' && <HobbyFields draft={edit.draft} />}
				{edit.type === 'note' && <NoteFields draft={edit.draft} />}

				{edit.revisions.length > 0 && (
					<div style={{ borderTop: '1px solid var(--border-card-alt)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 11 }}>
						<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
							earlier printings · last 5 kept
						</span>
						{edit.revisions.map((revision) => (
							<div key={revision.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
								<div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
									<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
										{relativeTime(revision.createdAt)}
									</span>
									<span style={{ fontSize: 14, color: 'var(--text-body)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{revision.summary || 'no description'}
									</span>
								</div>
								<span className="chip-dashed" style={{ padding: '6px 13px', fontSize: 11.5, flexShrink: 0 }}
									onClick={() => h.loadRevision(revision)}>
									roll back ↺
								</span>
							</div>
						))}
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>
							// rolling back loads that printing — status travels with it — file it to keep it.
						</span>
					</div>
				)}

				<div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
					<button className="btn" style={{ padding: '12px 22px' }} onClick={() => { void h.saveEdit(); }}>
						{edit.id === null ? 'file it' : 'save changes'}
					</button>
					<span className="ghost-link" style={{ fontSize: 13 }} onClick={h.cancelEdit}>never mind</span>
				</div>
			</div>
		</div>
	);
}
