// Down at the cove. The three easter eggs riding the copy singleton: flip them
// loose or stowed, tune the cat's rounds, edit the proverbs and the light
// list. Saved as you type, the same debounced PUT as the signal flags.
import type { ReactNode } from 'react';
import { useHarbor, EGG_DEFS, CAT_CATALOG } from '../state/harbor';

function Toggle({ on, title, small, disabled, onFlip }: { on: boolean; title: string; small?: boolean; disabled?: boolean; onFlip: () => void }) {
	return (
		<button type="button" aria-pressed={on} disabled={disabled}
			className={`egg-toggle${on ? ' egg-toggle--on' : ''}${small ? ' egg-toggle--small' : ''}`}
			title={title} onClick={onFlip}>
			<span className="egg-toggle__knob" />
		</button>
	);
}

function EggCard({ egg, children }: { egg: (typeof EGG_DEFS)[number]; children: ReactNode }) {
	const h = useHarbor();
	const on = h.copy.eggs[egg.key];

	return (
		<div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 220 }}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 11, flexWrap: 'wrap' }}>
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--text-strong)' }}>{egg.name}</span>
						<span className={`egg-status${on ? ' egg-status--loose' : ''}`}>{on ? 'loose' : 'stowed'}</span>
					</div>
					<span style={{ fontSize: 15, color: 'var(--text-body)', lineHeight: 1.55 }}>{egg.blurb}</span>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)', marginTop: 2 }}>
						<span style={{ color: 'var(--text-dim)' }}>stowed in:</span> {egg.where}
					</span>
				</div>
				<Toggle on={on} title={on ? 'stow it away' : 'let it loose'} onFlip={() => h.toggleEgg(egg.key)} />
			</div>

			<div style={{
				display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px dashed rgba(150,160,220,.22)',
				paddingTop: 16, opacity: on ? 1 : .5, transition: 'opacity .25s',
			}}>
				{children}
			</div>
		</div>
	);
}

function CardMeta({ kicker, aside }: { kicker: string; aside: string }) {
	return (
		<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 4 }}>
			<span className="card-kicker" style={{ fontSize: 11 }}>{kicker}</span>
			<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{aside}</span>
		</div>
	);
}

const rowNum = (idx: number): string => String(idx + 1).padStart(2, '0');

export default function SmugglersCove() {
	const h = useHarbor();
	const { eggs, catPages, catSpots, bottleProverbs, lighthouses } = h.copy;
	const [bottleDef, catDef, lightsDef] = EGG_DEFS;
	const looseCount = EGG_DEFS.filter((egg) => eggs[egg.key]).length;

	// a spot is loose only when its page is too; count the pages carrying at
	// least one loose spot for the "N spots loose across M pages" line
	const looseSpots = CAT_CATALOG.reduce((n, pg) => n + (catPages[pg.id] ? pg.spots.filter((sp) => catSpots[sp.id]).length : 0), 0);
	const loosePages = CAT_CATALOG.filter((pg) => catPages[pg.id] && pg.spots.some((sp) => catSpots[sp.id])).length;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">down at the cove</span>
				<span className="page-title">Smuggler's cove</span>
				<span className="page-sub">The hidden delights stowed around the site. Flip them on, flip them off, no one's watching. (The office gremlins stay on regardless.)</span>
			</div>

			<div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--periwinkle-deep)', animation: 'fadeUp .7s ease .12s both' }}>
				<span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 10px 2px rgba(240,217,168,.5)' }} />
				<span>{looseCount} of {EGG_DEFS.length} loose on the site right now</span>
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .7s ease .18s both' }}>
				<EggCard egg={bottleDef}>
					<CardMeta kicker="what washes ashore" aside={`${bottleProverbs.length} in the bottle · one shows per poke`} />
					{bottleProverbs.map((proverb, idx) => (
						<div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', width: 20, textAlign: 'right', flexShrink: 0 }}>{rowNum(idx)}</span>
							<input type="text" className="input input--serif-italic" style={{ padding: '10px 12px' }}
								value={proverb}
								onChange={(e) => h.setProverb(idx, e.target.value)} />
							<button type="button" className="cove-x" title="let the tide take this one" onClick={() => h.removeProverb(idx)}>✕</button>
						</div>
					))}
					<button type="button" className="cove-add" onClick={h.addProverb}>+ cast a new one out</button>
				</EggCard>

				<EggCard egg={catDef}>
					<CardMeta kicker="where it roams" aside={`${looseSpots} spots loose across ${loosePages} pages`} />
					{CAT_CATALOG.map((pg, pi) => {
						const pageOn = catPages[pg.id];
						return (
							<div key={pg.id} className="cat-page" style={{
								display: 'flex', flexDirection: 'column', gap: 11,
								...(pi > 0 ? { borderTop: '1px dashed rgba(150,160,220,.22)', paddingTop: 15 } : null),
							}}>
								<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
									<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
										<span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-strong)' }}>{pg.label}</span>
										<span className={`egg-status${pageOn ? ' egg-status--loose' : ''}`}>{pageOn ? 'loose' : 'stowed'}</span>
									</div>
									<Toggle on={pageOn} title={pageOn ? 'keep the cat off this page' : 'let the cat onto this page'} onFlip={() => h.toggleCatPage(pg.id)} />
								</div>
								<div style={{
									display: 'flex', flexDirection: 'column', gap: 9, paddingLeft: 15,
									borderLeft: '1px dashed rgba(150,160,220,.22)',
									opacity: pageOn ? 1 : .4, transition: 'opacity .25s',
								}}>
									{pg.spots.map((sp) => (
										<div key={sp.id} className="cat-spot" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
											<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
												<span style={{ fontSize: 14, color: 'var(--text-base)' }}>{sp.label}</span>
												<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{sp.hint}</span>
											</div>
											<Toggle small disabled={!pageOn} on={catSpots[sp.id]}
												title={catSpots[sp.id] ? 'keep it off here' : 'let it perch here'}
												onFlip={() => h.toggleCatSpot(sp.id)} />
										</div>
									))}
								</div>
							</div>
						);
					})}
				</EggCard>

				<EggCard egg={lightsDef}>
					<CardMeta kicker="known lights" aside={`${lighthouses.length} on the chart · one per wreck`} />
					{lighthouses.map((light, idx) => (
						<div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', width: 20, textAlign: 'right', flexShrink: 0, paddingTop: 12 }}>{rowNum(idx)}</span>
							<div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
								<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
									<input type="text" className="input input--serif" placeholder="the light"
										style={{ flex: 1, minWidth: 150, width: 'auto', padding: '10px 12px' }}
										value={light.name}
										onChange={(e) => h.setLight(idx, { name: e.target.value })} />
									<input type="text" className="input" placeholder="51°23′N 9°36′W"
										style={{ width: 170, fontSize: 12.5, padding: '10px 12px' }}
										value={light.pos}
										onChange={(e) => h.setLight(idx, { pos: e.target.value })} />
								</div>
								<input type="text" className="input input--serif-italic" placeholder="one line about it, for whoever clicks"
									style={{ fontSize: 14.5, padding: '10px 12px' }}
									value={light.line}
									onChange={(e) => h.setLight(idx, { line: e.target.value })} />
							</div>
							<button type="button" className="cove-x" title="strike it from the chart" style={{ marginTop: 6 }} onClick={() => h.removeLight(idx)}>✕</button>
						</div>
					))}
					<button type="button" className="cove-add" onClick={h.addLight}>+ chart another light</button>
				</EggCard>
			</div>

			<span className="footnote">// flip a switch and it takes effect on the next lantern hoist.</span>
		</div>
	);
}
