// The edit overlay: project, headstone, and note forms, the light designer,
// the gallery picker, and the earlier-printings (revisions) section.
// "File it" on a restored draft goes through the restore endpoint; that's
// the server copy-forward that makes status travel with the printing.
import { useHarbor } from '../state/harbor';
import type { EditState, HobbyDraft, NoteDraft, ProjectDraft } from '../state/harbor';
import type { Category, LightColor, LightKind } from '../lib/api';
import { codeFor, LETTERS, randomLight, RHYTHM_KINDS, wordsFor } from '../lib/lightChar';
import { printBackground } from '../lib/prints';
import { relativeTime } from '../lib/time';
import Lamp from './Lamp';
import { ShapeNode } from './ShapeEditor';

const CATEGORIES: Category[] = ['backend', 'games', 'this website', 'tinkering'];

const KICKERS: Record<EditState['type'], string> = {
	project: 'light · ',
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

const KIND_OPTIONS: { id: LightKind; label: string }[] = [
	{ id: 'fixed',     label: 'fixed · steady' },
	{ id: 'flash',     label: 'flashing' },
	{ id: 'occult',    label: 'occulting' },
	{ id: 'iso',       label: 'isophase' },
	{ id: 'quick',     label: 'quick' },
	{ id: 'veryquick', label: 'very quick' },
	{ id: 'morse',     label: 'morse' },
];

const COLOR_OPTIONS: { id: LightColor; label: string }[] = [
	{ id: 'white', label: 'white' },
	{ id: 'green', label: 'green · the playful ones' },
	{ id: 'red',   label: 'red · kept for home' },
];

const KIND_HINT: Record<LightKind, string> = {
	fixed:     'a steady beam, never blinking. for the things that must simply always be on.',
	flash:     'mostly dark, then one bright flash. for the dramatic ones, you notice when it speaks.',
	occult:    'mostly lit, with a brief eclipse. for the reliable ones with scheduled pauses.',
	iso:       'half light, half dark, evenly. for the ones rebuilt as often as they run.',
	quick:     'a fast, steady pulse, about once a second. for the ones you build in a weekend.',
	veryquick: 'twice as fast again, urgent. for the ones that will not sit still.',
	morse:     'spells a letter in international code, then rests. for the ones with a name worth spelling out.',
};

const EXTINGUISHED_MAX = 40;

// The rhythm slider's range per kind: morse needs room for its letter's
// pattern (the longest letters, J/Q/Y, run 5.2s of code, so the api floors
// it at 6), the rest keep the design's 2-12s.
const RHYTHM_RANGE: Record<'morse' | 'rest', { min: number; max: number }> = {
	morse: { min: 6, max: 30 },
	rest:  { min: 2, max: 12 },
};

function LightEditor({ draft }: { draft: ProjectDraft }) {
	const h = useHarbor();
	const light = draft.light;
	const range = light.kind === 'morse' ? RHYTHM_RANGE.morse : RHYTHM_RANGE.rest;

	// fixed/quick/veryquick hold no dialed-in rhythm, so switching onto one of
	// them drops the period; switching onto a rhythm kind keeps whatever was
	// already dialed in, or seeds one, clamped into the target kind's slider
	// range so the thumb never pins past its own ends. the letter only ever
	// means something on morse, so it clears the moment the kind steps off it,
	// and gets a starting pick the moment it steps on.
	const setKind = (kind: LightKind) => {
		if (!RHYTHM_KINDS.includes(kind)) {
			h.patchLight({ kind, period: 0, letter: '' });
			return;
		}
		const target = kind === 'morse' ? RHYTHM_RANGE.morse : RHYTHM_RANGE.rest;
		const period = Math.min(target.max, Math.max(target.min, light.period || (kind === 'morse' ? 8 : 5)));
		h.patchLight({ kind, period, letter: kind === 'morse' ? (light.letter || 'A') : '' });
	};

	return (
		<div className="fieldset-dashed" style={{ gap: 16 }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the light · how it burns on the coast</span>
				<span className="chip-dashed" onClick={() => h.patchLight(randomLight(light))}>⚄ let the sea decide</span>
			</div>
			<div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
				<div style={{
					width: 96, height: 96, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
					background: 'var(--well)', border: '1px solid var(--border-input)', borderRadius: 8,
				}}>
					<Lamp light={light} size={16} haloScale={3.5} />
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 230 }}>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, letterSpacing: '.1em', color: 'var(--gold)' }}>{codeFor(light)}</span>
					<span style={{ fontSize: 14.5, fontStyle: 'italic', color: 'var(--text-body)', lineHeight: 1.5 }}>{wordsFor(light)}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
						// its signature: how a stranger tells this light from the others on the coast.
					</span>
				</div>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the pattern</span>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{KIND_OPTIONS.map((opt) => (
						<DesignerChip key={opt.id} selected={light.kind === opt.id} label={opt.label} onClick={() => setKind(opt.id)} />
					))}
				</div>
				<span style={{ fontSize: 13.5, fontStyle: 'italic', color: 'var(--text-dim)' }}>{KIND_HINT[light.kind]}</span>
			</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the color</span>
				<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
					{COLOR_OPTIONS.map((opt) => (
						<DesignerChip key={opt.id} selected={light.color === opt.id} label={opt.label}
							onClick={() => h.patchLight({ color: opt.id })} />
					))}
				</div>
			</div>
			{RHYTHM_KINDS.includes(light.kind) && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
						<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>the rhythm</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>every {light.period} seconds</span>
					</div>
					<input type="range" min={range.min} max={range.max} step={1} value={light.period}
						onChange={(e) => h.patchLight({ period: parseInt(e.target.value, 10) })}
						style={{ width: '100%', accentColor: 'var(--periwinkle)', margin: 0 }} />
				</div>
			)}
			{light.kind === 'morse' && (
				<label className="field">
					<span className="field-label">the letter · spelled in morse</span>
					<select className="input" style={{ maxWidth: 90 }} value={light.letter}
						onChange={(e) => h.patchLight({ letter: e.target.value })}>
						{LETTERS.map((l) => <option key={l} value={l}>{l}</option>)}
					</select>
				</label>
			)}
			<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
				<label className="field">
					<span className="field-label">extinguished</span>
					<input type="text" className="input" style={{ maxWidth: 260 }} maxLength={EXTINGUISHED_MAX}
						placeholder="leave empty while it burns" value={light.extinguished}
						onChange={(e) => h.patchLight({ extinguished: e.target.value })} />
				</label>
				<span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--text-dim)' }}>
					a year here puts the light out · it stays on the list, just dark
				</span>
			</div>
			<label className="field">
				<span className="field-label">first lit</span>
				<input type="text" className="input" style={{ maxWidth: 110 }} placeholder="2026"
					value={draft.firstLit} onChange={(e) => h.patchDraft({ firstLit: e.target.value })} />
			</label>
		</div>
	);
}

const GALLERY_MAX = 12;

function GalleryPicker({ images }: { images: string[] }) {
	const h = useHarbor();
	const available = h.prints.filter((print) => !images.includes(print.filename));

	const add = (filename: string) => {
		if (images.length >= GALLERY_MAX) {
			h.showToast(`the gallery only holds ${GALLERY_MAX} prints`);
			return;
		}
		h.patchDraft({ images: [...images, filename] });
	};
	const remove = (index: number) => h.patchDraft({ images: images.filter((_, i) => i !== index) });
	const move = (index: number, dir: -1 | 1) => {
		const at = index + dir;
		if (at < 0 || at >= images.length) {
			return;
		}
		const next = [...images];
		[next[index], next[at]] = [next[at], next[index]];
		h.patchDraft({ images: next });
	};

	return (
		<div className="fieldset-dashed">
			<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
				the gallery · shown with the entry
			</span>
			{images.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{images.map((name, index) => (
						<div key={`${name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<div style={{ width: 44, height: 32, borderRadius: 2, flexShrink: 0, background: printBackground(h.prints, name) }} />
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{name}{index === 0 && <span style={{ color: 'var(--gold)' }}> · lead print</span>}
							</span>
							<span className="pill pill--arrow" onClick={() => move(index, -1)}>↑</span>
							<span className="pill pill--arrow" onClick={() => move(index, 1)}>↓</span>
							<span className="print-del" onClick={() => remove(index)}>✕</span>
						</div>
					))}
				</div>
			)}
			<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
				{available.map((print) => (
					<div key={print.filename} onClick={() => add(print.filename)} style={{
						display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', cursor: 'pointer',
						background: 'var(--paper)', borderRadius: 4, padding: '6px 6px 5px', transform: 'rotate(-1.2deg)',
						transition: 'transform .2s',
					}}>
						<div style={{ width: 64, height: 48, borderRadius: 2, background: printBackground(h.prints, print.filename) }} />
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--paper-name)', maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
							{print.filename}
						</span>
					</div>
				))}
				{available.length === 0 && (
					<span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-dim)' }}>every print is already in the gallery</span>
				)}
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
					<span className="field-label">station (category)</span>
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
				<span className="field-label">the register line · short description</span>
				<textarea className="input input--serif" rows={2} value={draft.shortDesc}
					onChange={(e) => h.patchDraft({ shortDesc: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">the entry · the full story</span>
				<textarea className="input input--serif" rows={6} value={draft.bodyText}
					placeholder="the long version: what happened, what broke, what you'd do differently. renders in the light's full entry."
					style={{ padding: '13px 14px', fontSize: 15.5, lineHeight: 1.65 }}
					onChange={(e) => h.patchDraft({ bodyText: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">moral of the story</span>
				<input type="text" className="input input--serif-italic" value={draft.moral}
					onChange={(e) => h.patchDraft({ moral: e.target.value })} />
			</label>
			<LightEditor draft={draft} />
			<GalleryPicker images={draft.images} />
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
				– signs itself "{h.keeper.signoff || '– j'}" on the way out
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
							// rolling back loads that printing; status travels with it, file it to keep it.
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
