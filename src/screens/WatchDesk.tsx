// The watch desk. The current-watch singleton, value-for-value from the
// design: the letter, the rotation line, up to three bearings, the season
// postcard, the cat's remarks, and a live preview of how the front door reads
// it. One record, written over whole on "keep the watch"; clearing keeps an
// empty one (the homepage section folds away until the next watch is kept).
import { useHarbor } from '../state/harbor';
import type { WatchBearingKind } from '../lib/api';
import { mediaUrl } from '../lib/api';
import CatPerch from '../components/CatPerch';
import './WatchDesk.css';

// keptAt is a fixed-width RFC3339 string; the front door prints its dateline
// lowercase and day-first, so the office previews it the same way.
function keptDate(keptAt: string, parts: Intl.DateTimeFormatOptions): string {
	const then = new Date(keptAt);
	return Number.isNaN(then.getTime()) ? '' : then.toLocaleDateString('en-GB', parts).toLowerCase();
}

// the strip stays one line; a long display name gives way, the record keeps it
const trunc = (t: string): string => (t.length > 24 ? t.slice(0, 23).trimEnd() + '…' : t);

export default function WatchDesk() {
	const h = useHarbor();
	const w = h.watch;

	const targetsFor = (kind: WatchBearingKind): { id: string; name: string }[] => {
		if ('light' === kind) {
			return h.projects.map((p) => ({ id: p.id, name: p.title }));
		}
		if ('hobby' === kind) {
			return h.hobbies.map((x) => ({ id: x.id, name: x.name }));
		}
		if ('note' === kind) {
			return h.notes.map((n) => ({ id: n.id, name: n.title }));
		}
		return [];
	};

	// picking a source refills the target and the shown name; edit freely after
	const pickSource = (idx: number, kind: WatchBearingKind) => {
		const list = targetsFor(kind);
		h.patchWatchBearing(idx, list.length ? { kind, targetId: list[0].id, name: list[0].name } : { kind, targetId: '' });
	};

	const pickTarget = (idx: number, kind: WatchBearingKind, id: string) => {
		const picked = targetsFor(kind).find((t) => t.id === id);
		h.patchWatchBearing(idx, { targetId: id, name: picked ? picked.name : id });
	};

	// the link rides on targetId (what was picked), not name (what it shows);
	// a bearing has lost its mark when its target no longer resolves at its source
	const orphans = w.bearings
		.filter((b) => b.kind !== 'none' && !targetsFor(b.kind).some((t) => t.id === b.targetId))
		.map((b) => b.name);

	const paras = w.letter.split(/\n\s*\n/).filter(Boolean);
	const notEmpty = Boolean(w.letter.trim()) || w.bearings.length > 0;
	const quips = w.quips.map((q) => q.trim()).filter(Boolean);
	// the record keys the postcards by filename: the media route serves
	// filenames, not ids, so a stored id would 404 on the front door
	const postcard = h.prints.find((p) => p.filename === w.postcardMediaId);
	const postcard2 = h.prints.find((p) => p.filename === w.postcard2MediaId);
	// two hooks on the rack: first empty hook takes a print; picking a hung
	// print takes it down; a new pick when both hooks are full replaces the second
	const choosePrint = (filename: string) => {
		if (w.postcardMediaId === filename) {
			h.patchWatch({ postcardMediaId: w.postcard2MediaId, postcard2MediaId: '' });
		} else if (w.postcard2MediaId === filename) {
			h.patchWatch({ postcard2MediaId: '' });
		} else if (!w.postcardMediaId) {
			h.patchWatch({ postcardMediaId: filename });
		} else {
			h.patchWatch({ postcard2MediaId: filename });
		}
	};
	const clearArmed = h.confirmKey === 'watch-clear';
	const clearWatch = () => {
		h.askConfirm('watch-clear', () => void h.clearWatch());
	};

	const keptShort = keptDate(w.keptAt, { day: 'numeric', month: 'short' });
	const keptFull = keptDate(w.keptAt, { day: 'numeric', month: 'short', year: 'numeric' });
	// before the first keep there is no stamp yet; the save date previews as now
	const season = keptDate(w.keptAt || new Date().toISOString(), { month: 'short', year: 'numeric' });

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">site copy</span>
				<span className="page-title">The watch desk</span>
				<span className="page-sub">What the front door says you are up to. One record, written over whole each time it is kept. Nothing here has a history, that is the point.</span>
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 26, alignItems: 'flex-start', animation: 'fadeUp .7s ease .15s both' }}>
				<div style={{ flex: '1 1 400px', minWidth: 320, display: 'flex', flexDirection: 'column', gap: 18 }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
						<label className="field" style={{ gap: 8 }}>
							<span className="card-kicker" style={{ fontSize: 11 }}>the letter</span>
							<textarea className="input input--serif" rows={8} style={{ borderRadius: 10, padding: '14px 16px', lineHeight: 1.6 }}
								value={w.letter}
								onChange={(e) => h.patchWatch({ letter: e.target.value })} />
						</label>
						<span className="footnote" style={{ fontSize: 11 }}>// a letter, not a log. a blank line starts a new paragraph.</span>
					</div>

					<label className="field" style={{ gap: 8 }}>
						<span className="card-kicker" style={{ fontSize: 11 }}>out of the rotation</span>
						<input type="text" className="input input--serif-italic" style={{ borderRadius: 10, padding: '11px 16px', color: 'var(--text-body)', fontSize: 14.5 }}
							value={w.rotation}
							onChange={(e) => h.patchWatch({ rotation: e.target.value })} />
					</label>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<span className="card-kicker" style={{ fontSize: 11 }}>the bearings · three at most</span>
						{orphans.length > 0 && (
							<span style={{
								fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--gold)', lineHeight: 1.6,
								background: 'rgba(240,217,168,.07)', border: '1px solid rgba(240,217,168,.3)', borderRadius: 8, padding: '9px 12px',
							}}>
								{`lost its mark: "${orphans.join('", "')}" no longer matches anything at its source. the name stays; the link went with the tide.`}
							</span>
						)}
						{w.bearings.map((b, i) => (
							<div key={i} style={{
								display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--well)',
								border: '1px solid var(--border-card-alt)', borderRadius: 10, padding: '12px 14px',
							}}>
								<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
									<input type="text" className="input input--inset" title="the verb. wrangling, plotting, reading..."
										style={{ width: 104, padding: '8px 10px', color: 'var(--periwinkle)', fontSize: 12 }}
										value={b.verb}
										onChange={(e) => h.patchWatchBearing(i, { verb: e.target.value })} />
									<select className="input input--inset" aria-label="the source"
										style={{ width: 'auto', padding: '8px 10px', color: 'var(--text-soft)', fontSize: 12 }}
										value={b.kind}
										onChange={(e) => pickSource(i, e.target.value as WatchBearingKind)}>
										<option value="none">points nowhere yet</option>
										<option value="light">a light</option>
										<option value="hobby">a hobby</option>
										<option value="note">a note</option>
									</select>
									{b.kind !== 'none' && (
										<select className="input input--inset" aria-label="the target"
											style={{ flex: 1, width: 'auto', minWidth: 150, padding: '8px 10px', color: 'var(--text-soft)', fontSize: 12 }}
											value={b.targetId}
											onChange={(e) => pickTarget(i, b.kind, e.target.value)}>
											{targetsFor(b.kind).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
										</select>
									)}
									<span className="strike-x" title="strike the bearing" style={{ marginLeft: 'auto' }}
										onClick={() => h.removeWatchBearing(i)}>✕</span>
								</div>
								<input type="text" className="input input--inset" title="what the front door shows. picking a source refills it; edit freely after."
									style={{ padding: '8px 12px', fontSize: 12.5 }}
									value={b.name}
									onChange={(e) => h.patchWatchBearing(i, { name: e.target.value })} />
							</div>
						))}
						{w.bearings.length < 3 && (
							<button className="dash-add" onClick={h.addWatchBearing}>+ a bearing</button>
						)}
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<span className="card-kicker" style={{ fontSize: 11 }}>the postcards · from the darkroom · two hooks on the rack</span>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
							{h.prints.map((print) => {
								const onFirst = w.postcardMediaId === print.filename;
								const onSecond = w.postcard2MediaId === print.filename;
								const pick = onFirst ? '❀ first hook' : onSecond ? '❀ second hook' : null;
								return (
									<div key={print.id} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }}
										onClick={() => choosePrint(print.filename)}>
										<div style={{
											width: '100%', height: 58, borderRadius: 7, background: `url("${mediaUrl(print.url)}") center/cover`,
											border: (onFirst || onSecond) ? '2px solid var(--gold)' : '1px solid var(--border-input)',
											transition: 'border-color .18s', boxSizing: 'border-box',
										}} />
										<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--text-body)', wordBreak: 'break-all' }}>{print.filename}</span>
										{pick && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.08em', color: 'var(--gold)', textTransform: 'uppercase' }}>{pick}</span>}
									</div>
								);
							})}
						</div>
						<span className="footnote" style={{ fontSize: 11, lineHeight: 1.6 }}>// pick up to two prints: the first hangs big, the second tucks in below it. tap one again to take it down. captions stamp themselves from the save date. new prints develop in the darkroom tab.</span>
					</div>

					<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<span className="card-kicker" style={{ fontSize: 11 }}>the cat's remarks</span>
						{w.quips.map((q, i) => (
							<div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
								<input type="text" className="input input--inset" style={{ flex: 1, width: 'auto', minWidth: 0, padding: '8px 12px', color: 'var(--text-soft)', fontSize: 12 }}
									value={q}
									onChange={(e) => h.setWatchQuip(i, e.target.value)} />
								<span className="strike-x" title="the cat forgets this one" onClick={() => h.removeWatchQuip(i)}>✕</span>
							</div>
						))}
						<button className="dash-add" style={{ padding: '10px 16px' }} onClick={h.addWatchQuip}>+ a remark</button>
						<span className="footnote" style={{ fontSize: 11, lineHeight: 1.6 }}>// these belong to the watch cat only. tailor them to the letter; the cat elsewhere keeps its own material. the remarks ride out a clear. click the preview cat to hear one.</span>
					</div>

					<div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', borderTop: '1px solid rgba(150,160,220,.14)', paddingTop: 16 }}>
						<button className="btn btn--gold" style={{ padding: '11px 22px' }} onClick={() => void h.keepWatch()}>keep the watch</button>
						<span className="ghost-link ghost-link--danger" style={{ fontSize: 12 }} onClick={clearWatch}>
							{clearArmed ? 'sure? the letter goes blank' : 'clear the watch'}
						</span>
						{h.watchFlash && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#6fca97' }}>{h.watchFlash}</span>}
						<span className="footnote" style={{ fontSize: 11, flex: '1 1 100%' }}>
							{keptFull ? `// the dateline stamps itself on save · last kept ${keptFull}` : '// the dateline stamps itself on save · no watch kept yet'}
						</span>
					</div>
				</div>

				<div style={{ flex: '1 1 360px', minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 20 }}>
					<span className="card-kicker" style={{ fontSize: 11 }}>how the front door reads it</span>
					{notEmpty && (
						<div className="watch-preview">
							<CatPerch quips={quips.length ? quips : ['no remarks. suspicious.']} bubbleSide="left" style={{ top: -36, right: 24 }} />
							<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px 12px' }}>
								<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>
									<span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 7px 2px rgba(240,217,168,.55)', animation: 'lampPulse 4s ease-in-out infinite' }} />
									Now
								</span>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>{keptShort && `kept ${keptShort}`}</span>
							</div>
							{paras.map((p, i) => (
								<div key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.65, color: 'var(--text-body)', fontWeight: 300, textWrap: 'pretty' }}>{p}</div>
							))}
							{Boolean(w.rotation.trim()) && (
								<div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic', color: '#9aa3c9', lineHeight: 1.6, textWrap: 'pretty' }}>Out of the rotation on purpose: {w.rotation}</div>
							)}
							{w.bearings.length > 0 && (
								<div className="watch-strip">
									{w.bearings.map((b, i) => (
										<span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
											{i > 0 && <span style={{ color: '#3d4468' }}>·</span>}
											<span style={{ color: '#8a93c4' }}>{b.verb}</span>
											<span style={{ color: 'none' === b.kind ? '#d6dcf4' : 'var(--gold)' }}>{trunc(b.name)}</span>
										</span>
									))}
								</div>
							)}
						</div>
					)}
					{postcard && (
						<div style={{
							alignSelf: 'flex-end', width: 200, display: 'flex', flexDirection: 'column', gap: 7,
							background: '#252b49', border: '1px solid rgba(150,160,220,.22)', padding: '7px 7px 10px',
							boxShadow: '0 8px 20px rgba(0,0,0,.45)', transform: 'rotate(1.6deg)',
						}}>
							<div style={{ width: '100%', height: 92, background: `url("${mediaUrl(postcard.url)}") center/cover` }} />
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'var(--periwinkle)', textAlign: 'center' }}>from the season · {season}</span>
						</div>
					)}
					{postcard2 && (
						<div style={{
							alignSelf: 'flex-end', width: 156, marginTop: -2, display: 'flex', flexDirection: 'column', gap: 6,
							background: '#252b49', border: '1px solid rgba(150,160,220,.22)', padding: '6px 6px 9px',
							boxShadow: '0 8px 18px rgba(0,0,0,.45)', transform: 'rotate(-2deg)',
						}}>
							<div style={{ width: '100%', height: 70, background: `url("${mediaUrl(postcard2.url)}") center/cover` }} />
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--periwinkle-deep)', textAlign: 'center' }}>also from the season · the keeper liked it</span>
						</div>
					)}
					{!notEmpty && (
						<div style={{
							border: '1.5px dashed var(--border-chip)', borderRadius: 14, padding: 26,
							display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center',
						}}>
							<span style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 14.5, color: 'var(--text-dim)' }}>The watch stands empty.</span>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>the homepage section folds away until the next one is kept</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
