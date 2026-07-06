// Below decks. The three easter eggs riding the copy singleton — flip them
// loose or stowed, tune the cat's rounds, edit the proverbs and the light
// list. Saved as you type, the same debounced PUT as the signal flags.
import type { ReactNode } from 'react';
import { useHarbor, EGG_DEFS, CAT_LOCS } from '../state/harbor';

function Toggle({ on, title, small, onFlip }: { on: boolean; title: string; small?: boolean; onFlip: () => void }) {
	return (
		<div className={`egg-toggle${on ? ' egg-toggle--on' : ''}${small ? ' egg-toggle--small' : ''}`}
			title={title} onClick={onFlip}>
			<div className="egg-toggle__knob" />
		</div>
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

export default function SmugglersHold() {
	const h = useHarbor();
	const { eggs, catLocs, bottleProverbs, lighthouses } = h.copy;
	const [bottleDef, catDef, lightsDef] = EGG_DEFS;
	const looseCount = EGG_DEFS.filter((egg) => eggs[egg.key]).length;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">below decks</span>
				<span className="page-title">Smuggler's hold</span>
				<span className="page-sub">The hidden delights stowed around the site. Flip them on, flip them off — no one's watching. (The office gremlins stay on regardless.)</span>
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
							<span className="hold-x" title="toss this one overboard" onClick={() => h.removeProverb(idx)}>✕</span>
						</div>
					))}
					<span className="hold-add" onClick={h.addProverb}>＋ cast a new one out</span>
				</EggCard>

				<EggCard egg={catDef}>
					<CardMeta kicker="where it roams" aside="lives at the lighthouse · out on its rounds" />
					{CAT_LOCS.map((loc) => (
						<div key={loc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
							<div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
								<span style={{ fontSize: 15, color: 'var(--text-base)' }}>{loc.label}</span>
								<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>{loc.hint}</span>
							</div>
							<Toggle small on={catLocs[loc.key]}
								title={catLocs[loc.key] ? 'keep it off here' : 'let it roam here'}
								onFlip={() => h.toggleCatLoc(loc.key)} />
						</div>
					))}
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
							<span className="hold-x" title="strike it from the chart" style={{ marginTop: 6 }} onClick={() => h.removeLight(idx)}>✕</span>
						</div>
					))}
					<span className="hold-add" onClick={h.addLight}>＋ chart another light</span>
				</EggCard>
			</div>

			<span className="footnote">// flip a switch and it takes effect on the next lantern hoist.</span>
		</div>
	);
}
