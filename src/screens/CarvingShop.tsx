// The carving shop. Every hand-carved SVG on the site, catalogued by page on
// the left, one bench on the right: raw source, a live preview, and the bolt
// that assigns a carving to a spot. Retires the old pose-carver UI wholesale
// (see the PR body); the figurehead contract this shop used to edit is
// untouched, it just isn't reachable from this screen anymore.
import { useEffect, useState } from 'react';
import { useHarbor } from '../state/harbor';
import type { CarvingCatalogEntry } from '../state/harbor';
import { CARVING_CATALOG } from '../state/harbor';
import type { Carving } from '../lib/api';
import CatPerch from '../components/CatPerch';
import './CarvingShop.css';

const CAT_QUIPS = ['supervising.', 'carve nothing without me.', 'approval pending. indefinitely.'];

const STARTER_SVG = '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="12" stroke="#93a0e8" stroke-width="1.5"></circle><path d="M20 8 V3" stroke="#f0d9a8" stroke-width="1.5"></path></svg>';

const CHISELS = [
	{ id: 'straightedge', glyph: '◇', label: 'straightedge' },
	{ id: 'knife', glyph: '✎', label: 'carving knife' },
	{ id: 'plank', glyph: '▭', label: 'plank' },
	{ id: 'ring', glyph: '○', label: 'ring' },
	{ id: 'grain', glyph: '≋', label: 'wood grain' },
];

// The loose SVG rules, in keeper voice, keyed by spot: bench hint copy rather
// than a validator (operator ruling: rules are loose, communicated not enforced).
const SPOT_HINTS: Record<string, string> = {
	'lighthouse-logo': 'keep the viewBox honest, it sits small in the nav.',
	boat: 'keep the viewBox, the hero animation rides the boat\'s own coordinates.',
	bottle: 'keep the viewBox, it bobs on the wave at a fixed size.',
	'tower-stub': 'keep the lamp anchor so the light engine can still attach to it.',
	paw: 'keep the viewBox small, it walks across a single journal row.',
	'wave-line': 'keep it tileable, the pattern repeats edge to edge.',
	'boat-wake': 'keep it tileable, the pattern trails the boat edge to edge.',
};

interface CatalogGroup { page: string; items: CarvingCatalogEntry[] }

function groupByPage(entries: CarvingCatalogEntry[]): CatalogGroup[] {
	const groups: CatalogGroup[] = [];
	for (const entry of entries) {
		let g = groups.find((x) => x.page === entry.page);
		if (!g) {
			g = { page: entry.page, items: [] };
			groups.push(g);
		}
		g.items.push(entry);
	}
	return groups;
}

const CATALOG_GROUPS = groupByPage(CARVING_CATALOG);
const SPOTS = CARVING_CATALOG.filter((entry) => entry.spot);

// Carvings are raw SVG by contract (unlike the shape-JSON figurehead/doodle
// documents), so this is the one screen that renders markup instead of
// structured shapes. Neutralize <script the way the design mock does; the
// keeper is the only one who ever types here.
function safeSvg(svg: string): string {
	return svg.replace(/<\s*script/gi, '&lt;script');
}

function Thumb({ svg }: { svg: string | null }) {
	if (!svg) {
		return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)' }}>△</span>;
	}
	return <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: safeSvg(svg) }} />;
}

// One row shape shared by the fixed catalog and the bench group below it, so
// an unbolted carving is selectable the same way a spot or a note is.
function CatalogRow({ svg, name, where, selected, onClick }: {
	svg: string | null; name: string; where: string; selected: boolean; onClick: () => void;
}) {
	return (
		<button type="button" className={`carving-row${selected ? ' carving-row--sel' : ''}`} onClick={onClick}>
			<span className="carving-thumb"><Thumb svg={svg} /></span>
			<span className="carving-row__text">
				<span className="carving-row__name">{name}</span>
				<span className="carving-row__where">{where}</span>
			</span>
		</button>
	);
}

type Selection = { kind: 'carving'; id: string } | { kind: 'note'; id: string };

export default function CarvingShop() {
	const h = useHarbor();
	const [sel, setSel] = useState<Selection | null>(null);
	const [draft, setDraft] = useState<{ id: string; svg: string } | null>(null);
	const [assignSpot, setAssignSpot] = useState<string>(SPOTS[0].id);
	const [chisel, setChisel] = useState<string | null>(null);

	const bolted = (spotId: string): Carving | undefined => h.carvings.find((c) => c.boltedTo.includes(spotId));

	// Default the bench to whatever the first spot carries, once the catalog
	// has loaded; a keeper's own click never gets second-guessed after that.
	useEffect(() => {
		if (sel || !h.carvings.length) {
			return;
		}
		const carving = bolted(SPOTS[0].id);
		if (carving) {
			setSel({ kind: 'carving', id: carving.id });
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [h.carvings, sel]);

	const selectSpot = (entry: CarvingCatalogEntry) => {
		const carving = bolted(entry.id);
		if (!carving) {
			return;
		}
		setSel({ kind: 'carving', id: carving.id });
		setAssignSpot(entry.id);
		setDraft(null);
	};

	const selectNote = (entry: CarvingCatalogEntry) => {
		setSel({ kind: 'note', id: entry.id });
		setDraft(null);
	};

	const selectBench = (carving: Carving) => {
		setSel({ kind: 'carving', id: carving.id });
		setDraft(null);
	};

	const selectedCarving = sel?.kind === 'carving' ? h.carvings.find((c) => c.id === sel.id) ?? null : null;
	const selectedNote = sel?.kind === 'note' ? CARVING_CATALOG.find((e) => e.id === sel.id) ?? null : null;

	const bench = draft && selectedCarving && draft.id === selectedCarving.id ? draft.svg : (selectedCarving?.svg ?? '');
	const dirty = Boolean(draft && selectedCarving && draft.id === selectedCarving.id && draft.svg !== selectedCarving.svg);
	const editable = Boolean(selectedCarving && !selectedCarving.builtin);

	const customCount = h.carvings.filter((c) => !c.builtin).length;

	// The mock's own model: the catalog is [...svgCatalog, ...custom], and a
	// block that holds no spot lives under "the bench". Without this group a
	// saved fresh block would vanish on navigation, and a seed displaced by the
	// bolt auto-swap would be unreachable for re-bolting.
	const onTheBench = h.carvings.filter((c) => !c.boltedTo.length);

	const freshBlock = async () => {
		const saved = await h.saveCarving(null, { name: `fresh carving no. ${customCount + 1}`, svg: STARTER_SVG });
		if (saved) {
			setSel({ kind: 'carving', id: saved.id });
			setDraft(null);
		}
	};

	const copyToFresh = async () => {
		if (!selectedCarving) {
			return;
		}
		const saved = await h.saveCarving(null, { name: `${selectedCarving.name} copy`, svg: selectedCarving.svg });
		if (saved) {
			setSel({ kind: 'carving', id: saved.id });
			setDraft(null);
		}
	};

	const saveBench = async () => {
		if (!selectedCarving || !dirty) {
			return;
		}
		const saved = await h.saveCarving(selectedCarving.id, { name: selectedCarving.name, svg: bench });
		if (saved) {
			setDraft(null);
		}
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative' }}>
			<CatPerch quips={CAT_QUIPS} style={{ top: -10, right: 22 }} />
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the carvings</span>
				<span className="page-title">The carving shop</span>
				<span className="page-sub">Every carving on the site, catalogued and on the bench. The cat supervises; it has approved none of it.</span>
			</div>

			<div className="carving-layout" style={{ animation: 'fadeUp .7s ease .15s both' }}>
				<div className="carving-catalog">
					<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, paddingBottom: 4 }}>
						<span className="field-label">the catalog</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
							{CARVING_CATALOG.length} on the books · {customCount} fresh
						</span>
					</div>
					{CATALOG_GROUPS.map((group) => (
						<div key={group.page} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
							<span className="carving-group">{group.page}</span>
							{group.items.map((entry) => {
								const carving = entry.spot ? bolted(entry.id) : undefined;
								const isSel = entry.spot
									? Boolean(carving && selectedCarving?.id === carving.id)
									: selectedNote?.id === entry.id;
								return (
									<CatalogRow key={entry.id} svg={entry.spot ? (carving?.svg ?? null) : null}
										name={entry.name} where={entry.where} selected={isSel}
										onClick={() => (entry.spot ? selectSpot(entry) : selectNote(entry))} />
								);
							})}
						</div>
					))}
					{onTheBench.length > 0 && (
						<div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
							<span className="carving-group">the bench</span>
							{onTheBench.map((carving) => (
								<CatalogRow key={carving.id} svg={carving.svg || null}
									name={carving.name} where="fresh off the bench, unassigned"
									selected={selectedCarving?.id === carving.id}
									onClick={() => selectBench(carving)} />
							))}
						</div>
					)}
				</div>

				<div className="carving-bench-col">
					{selectedNote && (
						<div className="card card--alt" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
							<span className="row-title">{selectedNote.name}</span>
							<span className="row-sub" style={{ fontStyle: 'italic' }}>{selectedNote.note}</span>
						</div>
					)}

					{selectedCarving && (
						<>
							<div className="carving-toolbar">
								<div className="carving-chisels">
									{CHISELS.map((tool) => (
										<button key={tool.id} type="button" className="carving-chisel"
											title={`${tool.label} · for show`}
											aria-pressed={chisel === tool.id}
											onClick={() => setChisel((cur) => (cur === tool.id ? null : tool.id))}>
											{tool.glyph}
										</button>
									))}
								</div>
								<span className="footnote">// the chisels select. the markup below is what actually carves.</span>
								<button type="button" className="chip-dashed" style={{ marginLeft: 'auto' }} onClick={() => void freshBlock()}>
									+ a fresh block
								</button>
							</div>

							<div className="carving-canvas">
								<span className="carving-canvas__label">on the bench · {selectedCarving.name}</span>
								<span className="carving-canvas__art"><Thumb svg={bench || null} /></span>
								{selectedCarving.builtin && (
									<span className="carving-canvas__note">a seed is carved, it stays. copy it to a fresh block to edit.</span>
								)}
							</div>

							{editable ? (
								<textarea className="input" value={bench} onChange={(e) => setDraft({ id: selectedCarving.id, svg: e.target.value })}
									rows={10} spellCheck={false} aria-label="carving source"
									style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap', resize: 'vertical' }} />
							) : (
								<textarea className="input" value={selectedCarving.svg} readOnly aria-label="carving source, locked"
									rows={10} spellCheck={false}
									style={{ fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap', resize: 'vertical', opacity: .7 }} />
							)}

							<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
								{editable ? (
									<>
										<button type="button" className="pill" disabled={!dirty} onClick={() => void saveBench()}
											style={dirty ? undefined : { opacity: .5, cursor: 'default' }}>
											save the block
										</button>
										<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
											{dirty ? '◍ unsaved' : '○ saved'}
										</span>
									</>
								) : (
									<button type="button" className="pill" onClick={() => void copyToFresh()}>copy to a fresh block</button>
								)}
							</div>

							<div className="carving-bolt-row">
								<span className="field-label">bolt it to ·</span>
								<select className="input" aria-label="bolt it to" style={{ flex: '1 1 220px', width: 'auto' }} value={assignSpot}
									onChange={(e) => setAssignSpot(e.target.value)}>
									{SPOTS.map((entry) => (
										<option key={entry.id} value={entry.id}>{entry.name} · {entry.page}</option>
									))}
								</select>
								{/* bolting ships the SAVED doc, so an unsaved draft would bolt
								    stale markup; the bolt waits until the block is saved */}
								<button type="button" className="btn btn--gold" disabled={dirty}
									style={dirty ? { opacity: .5, cursor: 'default' } : undefined}
									onClick={() => void h.boltCarving(selectedCarving, assignSpot)}>
									⚒ bolt it into place
								</button>
							</div>
							<span className="footnote">◐ {SPOT_HINTS[assignSpot]} bolted carvings ship with the next hoist.</span>
						</>
					)}

					{!selectedCarving && !selectedNote && (
						<span className="row-sub" style={{ fontStyle: 'italic' }}>pick something off the shelf.</span>
					)}
				</div>
			</div>
		</div>
	);
}
