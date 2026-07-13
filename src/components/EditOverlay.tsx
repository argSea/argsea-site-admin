// The edit overlay: project, headstone, and note forms, the light designer,
// the pictures box, and the earlier-printings (revisions) section.
// "File it" on a restored draft goes through the restore endpoint; that's
// the server copy-forward that makes status travel with the printing.
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useHarbor } from '../state/harbor';
import type { EditState, HobbyDraft, NoteDraft, ProjectDraft } from '../state/harbor';
import type { Category, Fact, LightColor, LightKind, Note, Project } from '../lib/api';
import { HOBBY_STATES } from '../lib/api';
import { codeFor, LETTERS, randomLight, RHYTHM_KINDS, wordsFor } from '../lib/lightChar';
import { printBackground } from '../lib/prints';
import { relativeTime } from '../lib/time';
import Lamp from './Lamp';
import { ShapeNode } from './ShapeEditor';

const CATEGORIES: Category[] = ['backend', 'games', 'this website', 'tinkering'];

const KICKERS: Record<EditState['type'], string> = {
	project: 'light · ',
	hobby:   'chart mark · ',
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

const IMAGES_MAX = 6;
const FACTS_MAX = 6;

// The single picker: darkroom prints only, search field, capped at six, the
// first row is the entry photo. Replaces the old cap-12 gallery's own
// per-row reorder; a picture's rank is just where it landed in the archive.
function PicturesBox({ images }: { images: string[] }) {
	const h = useHarbor();
	const [q, setQ] = useState('');
	const query = q.trim().toLowerCase();
	const canAdd = images.length < IMAGES_MAX;
	const available = h.prints.filter((print) => !images.includes(print.filename)
		&& (!query || print.filename.toLowerCase().includes(query)));

	const add = (filename: string) => {
		if (!canAdd) {
			h.showToast(`the archive only holds ${IMAGES_MAX} pictures`);
			return;
		}
		h.patchDraft({ images: [...images, filename] });
	};
	const remove = (index: number) => h.patchDraft({ images: images.filter((_, i) => i !== index) });

	return (
		<div className="fieldset-dashed">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
					the pictures · station archive, up to six
				</span>
				<input type="text" className="input" style={{ width: 'auto', flex: '0 1 180px', borderRadius: 999, padding: '7px 13px', fontSize: 11.5 }}
					placeholder="search prints..." value={q} onChange={(e) => setQ(e.target.value)} />
			</div>
			{images.length > 0 && (
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{images.map((name, index) => (
						<div key={`${name}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<div style={{ width: 44, height: 32, borderRadius: 2, flexShrink: 0, background: printBackground(h.prints, name) }} />
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-soft)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
								{name}
							</span>
							{index === 0 && (
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>
									⚑ entry photo · shows with the light
								</span>
							)}
							<span className="print-del" onClick={() => remove(index)}>✕</span>
						</div>
					))}
				</div>
			)}
			{canAdd && (
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
						<span style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-dim)' }}>
							{query ? 'nothing hanging to dry matches that.' : 'every print is already in the archive'}
						</span>
					)}
				</div>
			)}
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.7 }}>
				// prints come from the darkroom: develop there, pick here. the first picture is the entry photo (polaroid and overlay), and any of them can be called in the full log as ![caption](name).
			</span>
		</div>
	);
}

// Facts editor: heading → fact rows, capped at six, headings are the
// keeper's own per light (ownership, scale, audience, fate, whatever).
function FactsBox({ facts }: { facts: Fact[] }) {
	const h = useHarbor();
	const canAdd = facts.length < FACTS_MAX;

	const setFact = (i: number, key: keyof Fact, value: string) =>
		h.patchDraft({ facts: facts.map((f, fi) => (fi === i ? { ...f, [key]: value } : f)) });
	const removeFact = (i: number) => h.patchDraft({ facts: facts.filter((_, fi) => fi !== i) });
	const addFact = () => h.patchDraft({ facts: [...facts, { heading: '', fact: '' }] });

	return (
		<div className="fieldset-dashed">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>
					the facts · heading → fact, up to six
				</span>
				{canAdd && <span className="chip-dashed" onClick={addFact}>+ add a fact</span>}
			</div>
			{facts.map((f, i) => (
				<div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 170px) 1fr 34px', gap: 10, alignItems: 'center' }}>
					<input type="text" className="input" style={{ padding: '9px 11px', fontSize: 12, color: 'var(--periwinkle)', textTransform: 'lowercase' }}
						placeholder="ownership" value={f.heading} onChange={(e) => setFact(i, 'heading', e.target.value)} />
					<input type="text" className="input input--serif" style={{ padding: '9px 11px', fontSize: 14.5 }}
						placeholder="design to operations, solo" value={f.fact} onChange={(e) => setFact(i, 'fact', e.target.value)} />
					<span className="print-del" style={{ textAlign: 'center' }} title="strike it from the record" onClick={() => removeFact(i)}>✕</span>
				</div>
			))}
			{facts.length === 0 && (
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
					// no facts filed. the entry simply renders without the grid.
				</span>
			)}
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.7 }}>
				// headings are yours, per light: ownership, scale, audience, fate, whatever this one needs answered first.
			</span>
		</div>
	);
}

const CASE_STUDY_PLACEHOLDER =
	'## The starting point\n\nplain paragraphs · > log asides · - lists · [? facts to fill in ?]\n\n:::facts\ntimeline: 6 months\n:::\n\n```mermaid\nflowchart TB\n  a --> b\n```';

// The full log: markdown in the keeper's dialect, hoistable from a file, plus
// the slug field (operator ruling, beyond the mock: a project with a case
// study needs a stable public route, argsea.com/projects/<slug>).
function CaseStudyBox({ draft }: { draft: ProjectDraft }) {
	const h = useHarbor();
	const [fileNote, setFileNote] = useState<string | null>(null);

	const onFile = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			h.patchDraft({ caseStudy: String(reader.result ?? '') });
			setFileNote(`⚑ ${file.name} hoisted aboard`);
		};
		reader.readAsText(file);
	};

	return (
		<div className="fieldset-dashed fieldset-dashed--gold">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--gold)' }}>
					the full log · case study, markdown
				</span>
				<label className="pill" style={{ cursor: 'pointer' }}>
					⇪ hoist a .md file
					<input type="file" accept=".md,.markdown,.txt" style={{ display: 'none' }} onChange={onFile} />
				</label>
			</div>
			<label className="field">
				<span className="field-label">slug · argsea.com/projects/&lt;slug&gt;</span>
				<input type="text" className="input" style={{ maxWidth: 280 }} value={draft.slug}
					onChange={(e) => h.patchDraft({ slug: e.target.value })} />
			</label>
			<textarea className="input" rows={10} placeholder={CASE_STUDY_PLACEHOLDER}
				style={{ fontSize: 13, lineHeight: 1.6, padding: '13px 14px' }}
				value={draft.caseStudy} onChange={(e) => h.patchDraft({ caseStudy: e.target.value })} />
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.7 }}>
				// any light can carry a full log. dialect: ## sections · &gt; from-the-log asides · - lists · [? fact needed ?] · :::facts and :::outcomes blocks · ```mermaid charts. leave empty and the light simply gets no "full log" link.
			</span>
			{fileNote && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold)' }}>{fileNote}</span>}
		</div>
	);
}

// The tie both directions write: this box is the project's half (search the
// book, tap to tie); the note editor's "kept in" box is the other half.
// Ties key by stable note ids (ruling 6), never titles.
function NoteTiesBox({ draft }: { draft: ProjectDraft }) {
	const h = useHarbor();
	const [q, setQ] = useState('');
	const query = q.trim().toLowerCase();

	const tied = draft.noteIds
		.map((id) => h.notes.find((n) => n.id === id))
		.filter((n): n is Note => !!n);
	const pool = h.notes.filter((n) => !draft.noteIds.includes(n.id));
	const found = query ? pool.filter((n) => n.title.toLowerCase().includes(query)) : null;
	const hint = query
		? 'tap a match to tuck it in.'
		: pool.length
			? `${pool.length} entr${pool.length === 1 ? 'y' : 'ies'} in the book · search to tuck one in.`
			: 'the whole book is in this light already.';
	const nudge = !draft.noteIds.length && !draft.caseStudy.trim();

	const toggle = (id: string) => h.patchDraft({
		noteIds: draft.noteIds.includes(id) ? draft.noteIds.filter((x) => x !== id) : [...draft.noteIds, id],
	});

	return (
		<div className="fieldset-dashed">
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>notes found here</span>
				<input type="text" className="input" style={{ width: 'auto', flex: '0 1 200px', borderRadius: 999, padding: '7px 13px', fontSize: 11.5 }}
					placeholder="search the book..." value={q} onChange={(e) => setQ(e.target.value)} />
			</div>
			{tied.length > 0 && (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
					{tied.map((n) => (
						<span key={n.id} onClick={() => toggle(n.id)} title="untie it" className="sway-chip sway-chip--gold" style={{ animation: 'none', cursor: 'pointer' }}>
							✓ {n.title} · ✕
						</span>
					))}
				</div>
			)}
			{found && found.length > 0 && (
				<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 112, overflowY: 'auto', paddingRight: 4 }}>
					{found.map((n) => (
						<span key={n.id} onClick={() => toggle(n.id)} className="chip-dashed" style={{ color: 'var(--periwinkle)', borderColor: 'rgba(147,160,232,.4)', borderStyle: 'dashed' }}>
							+ {n.title}
						</span>
					))}
				</div>
			)}
			{query && found && found.length === 0 && (
				<span style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--periwinkle-deep)', fontStyle: 'italic' }}>
					nothing in the book matches. the entry may not be written yet.
				</span>
			)}
			{nudge && (
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--amber-nudge)', fontStyle: 'italic' }}>
					⚑ no note, no full log. even a short page keeps the record honest.
				</span>
			)}
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.7 }}>
				// encouraged, never required. {hint}
			</span>
		</div>
	);
}

// The writing desk's half of the tie: tapping a light toggles this note's id
// in that project's noteIds. A note with no id yet (unsaved) has nothing to
// tie; the office says so instead of silently doing nothing.
function KeptInBox({ noteId }: { noteId: string | null }) {
	const h = useHarbor();

	return (
		<div className="fieldset-dashed">
			<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>kept in</span>
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
				{h.projects.map((p: Project) => {
					const on = !!noteId && (p.noteIds ?? []).includes(noteId);
					return (
						<button key={p.id} type="button" aria-pressed={on}
							className={`pill ${on ? 'pill--on' : 'pill--quiet'}`}
							style={{ cursor: noteId ? 'pointer' : 'not-allowed', opacity: noteId ? 1 : .5 }}
							onClick={() => {
								if (!noteId) {
									h.showToast('⚑ file the entry first; a tie needs an id.');
									return;
								}
								void h.toggleNoteTie(p, noteId);
							}}>
							{on ? '✓ ' : '○ '}{p.title}
						</button>
					);
				})}
			</div>
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.7 }}>
				// tap a light. visitors find the note in its entry.
			</span>
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
			<NoteTiesBox draft={draft} />
			<FactsBox facts={draft.facts} />
			<CaseStudyBox draft={draft} />
			<LightEditor draft={draft} />
			<PicturesBox images={draft.images} />
		</div>
	);
}

// The chart window the ships-log plots bearings into: the mock's chartWin
// bounds inset 3% per side, so a snapped mark sits fully inside the frame and
// never half-clips at the edge. The same band the API's bearings-clamp slice
// holds on the wire, named here so what the keeper sees is what will save.
// Longitude runs negative (west), the sign fmtCoord reads as W.
const CHART_LAT = [57.82, 58.56] as const;
const CHART_LON = [-7.94, -6.59] as const;

// Snap a coordinate input to its band on blur: blank stays blank (unplotted),
// an in-band value is left exactly as typed, an out-of-band number jumps to the
// nearest bound. Non-numeric text is left for the save-time pair check to catch.
function snapCoord(text: string, [lo, hi]: readonly [number, number]): string {
	if (text.trim() === '') {
		return text;
	}
	const n = parseFloat(text);
	if (isNaN(n)) {
		return text;
	}
	if (n < lo) {
		return String(lo);
	}
	if (n > hi) {
		return String(hi);
	}
	return text;
}

function HobbyFields({ draft }: { draft: HobbyDraft }) {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">keeper (hobby)</span>
					<input type="text" className="input input--display" value={draft.name}
						onChange={(e) => h.patchDraft({ name: e.target.value })} />
				</label>
				<label className="field">
					<span className="field-label">service · "one summer" reads as ancient</span>
					<input type="text" className="input" style={{ color: 'var(--text-soft)' }} placeholder="2023 · 2024" value={draft.service}
						onChange={(e) => h.patchDraft({ service: e.target.value })} />
				</label>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">charted position · latitude</span>
					<input type="number" step={0.01} className="input" style={{ color: 'var(--text-soft)' }} placeholder="58.20"
						value={draft.coordLat} onChange={(e) => h.patchDraft({ coordLat: e.target.value })}
						onBlur={() => h.patchDraft({ coordLat: snapCoord(draft.coordLat, CHART_LAT) })} />
				</label>
				<label className="field">
					<span className="field-label">· longitude</span>
					<input type="number" step={0.01} className="input" style={{ color: 'var(--text-soft)' }} placeholder="-7.40"
						value={draft.coordLon} onChange={(e) => h.patchDraft({ coordLon: e.target.value })}
						onBlur={() => h.patchDraft({ coordLon: snapCoord(draft.coordLon, CHART_LON) })} />
				</label>
			</div>
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>
				{`// the chart runs ${CHART_LAT[0]} to ${CHART_LAT[1]} north, ${-CHART_LON[0]} to ${-CHART_LON[1]} west · a bearing off the edge snaps back onto it`}
			</span>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
				<span className="field-label">state · how it sits on the chart</span>
				<div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
					{HOBBY_STATES.map((st) => (
						<DesignerChip key={st.key} selected={draft.state === st.key} label={st.label}
							onClick={() => h.patchDraft({ state: st.key })} />
					))}
				</div>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>
					// moored & made-port ride in port · adrift, marooned & ink-spilled have wandered off the fairway
				</span>
			</div>
			<div className="fieldset-dashed">
				<span className="field-label" style={{ letterSpacing: '.13em', color: 'var(--periwinkle)' }}>slipped from · where the drift began</span>
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
					<label className="field">
						<span className="field-label">origin lat</span>
						<input type="number" step={0.01} className="input" style={{ color: 'var(--text-soft)' }} placeholder="blank if never left"
							value={draft.fromLat} onChange={(e) => h.patchDraft({ fromLat: e.target.value })}
							onBlur={() => h.patchDraft({ fromLat: snapCoord(draft.fromLat, CHART_LAT) })} />
					</label>
					<label className="field">
						<span className="field-label">origin lon</span>
						<input type="number" step={0.01} className="input" style={{ color: 'var(--text-soft)' }} placeholder="blank if never left"
							value={draft.fromLon} onChange={(e) => h.patchDraft({ fromLon: e.target.value })}
							onBlur={() => h.patchDraft({ fromLon: snapCoord(draft.fromLon, CHART_LON) })} />
					</label>
				</div>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>
					// leave both blank and it draws no wake · fill them and a dotted drift runs from here to the mark
				</span>
			</div>
			<label className="field">
				<span className="field-label">sounding · seasons afloat</span>
				<input type="text" className="input" style={{ color: 'var(--text-soft)' }} placeholder="2"
					value={draft.seasons} onChange={(e) => h.patchDraft({ seasons: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">the bearing · how it reads on the chart</span>
				<input type="text" className="input input--serif-italic" placeholder="Kettle warm. Shoes by the door. Sea calm."
					value={draft.bearing} onChange={(e) => h.patchDraft({ bearing: e.target.value })} />
			</label>
			<label className="field">
				<span className="field-label">final entry · quoted on the record</span>
				<textarea className="input input--serif" rows={2} value={draft.lastLog}
					onChange={(e) => h.patchDraft({ lastLog: e.target.value })} />
			</label>
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
				<label className="field">
					<span className="field-label">what floats · what survived</span>
					<input type="text" className="input input--serif" value={draft.floats}
						onChange={(e) => h.patchDraft({ floats: e.target.value })} />
				</label>
				<label className="field">
					<span className="field-label">how it went off course</span>
					<input type="text" className="input input--serif" value={draft.offCourse}
						onChange={(e) => h.patchDraft({ offCourse: e.target.value })} />
				</label>
			</div>
			<label className="field">
				<span className="field-label">odds of return</span>
				<input type="text" className="input input--serif" placeholder="spring makes promises it won't keep"
					value={draft.odds} onChange={(e) => h.patchDraft({ odds: e.target.value })} />
			</label>
		</div>
	);
}

function NoteFields({ draft, id }: { draft: NoteDraft; id: string | null }) {
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
			<KeptInBox noteId={id} />
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
				{edit.type === 'note' && <NoteFields draft={edit.draft} id={edit.id} />}

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
