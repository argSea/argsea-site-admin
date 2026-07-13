// The flares roll call: who the coast wants back. Reads the traffic report's
// per-hobby flareRolls, resolves names from the store, and falls soft to the
// empty state when the report carries no flare fields (an API from before the
// tally) or simply has no flares yet. Colors are literal here: the flare accent
// is its own red, off the office's periwinkle palette.
import { useHarbor } from '../state/harbor';

export default function FlareRoll() {
	const h = useHarbor();
	const t = h.traffic;
	const rolls = t?.flareRolls ?? [];
	const total = t?.flares ?? rolls.reduce((n, r) => n + r.flares, 0);
	const maxCount = rolls.reduce((m, r) => Math.max(m, r.flares), 1);

	const plotName = (id: string): string => h.hobbies.find((x) => x.id === id)?.name ?? 'an unmarked plot';
	const totalLine = rolls.length === 0
		? 'the coast is quiet · no flares logged yet'
		: `${total} ${total === 1 ? 'flare' : 'flares'} logged · they want ${plotName(rolls[0].subject).toLowerCase()} back most`;

	return (
		<div className="overlay-backdrop" style={{ zIndex: 65 }} onClick={h.closeFlareRoll}>
			<div className="overlay-card" onClick={(e) => e.stopPropagation()} style={{
				width: 'min(560px, 100%)',
				border: '1px solid rgba(255,106,82,.35)',
				boxShadow: '0 30px 80px rgba(0,0,0,.6), inset 0 0 40px rgba(255,106,82,.06)',
			}}>
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
					padding: '16px clamp(20px, 4vw, 28px)', borderBottom: '1.5px dashed rgba(255,106,82,.3)',
				}}>
					<span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<svg width="18" height="18" viewBox="0 0 30 30" fill="none">
							<path d="M15 1 L17 13 L15 11 L13 13 Z M15 29 L13 17 L15 19 L17 17 Z M1 15 L13 13 L11 15 L13 17 Z M29 15 L17 17 L19 15 L17 13 Z" fill="#ff7a63" />
							<circle cx="15" cy="15" r="2.6" fill="#fff" />
						</svg>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '.14em', color: '#ff9a86', textTransform: 'uppercase' }}>
							flares from the coast
						</span>
					</span>
					<span className="pill" style={{ color: 'var(--text-body)' }} onClick={h.closeFlareRoll}>close ✕</span>
				</div>

				<div style={{ padding: 'clamp(20px, 4vw, 28px)', display: 'flex', flexDirection: 'column' }}>
					<div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 15, color: '#8f9be0', marginBottom: 6 }}>
						{totalLine}
					</div>

					{rolls.length > 0 ? rolls.map((roll) => (
						<div key={roll.subject} style={{ display: 'flex', flexDirection: 'column', gap: 9, borderTop: '1px solid rgba(150,160,220,.14)', padding: '15px 0' }}>
							<div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
								<span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: '#eef0fb' }}>{plotName(roll.subject)}</span>
								<span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
									<span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#ff7a63' }}>{roll.flares}</span>
									<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#a39876' }}>{roll.flares === 1 ? 'flare' : 'flares'}</span>
								</span>
							</div>
							<div style={{ height: 6, borderRadius: 999, background: 'rgba(255,106,82,.12)', overflow: 'hidden' }}>
								<div style={{
									width: `${Math.round((roll.flares / maxCount) * 100)}%`, height: 6, borderRadius: 999,
									background: 'linear-gradient(90deg,#ff7a63,#ff4834)', boxShadow: '0 0 8px rgba(255,106,82,.5)',
								}} />
							</div>
						</div>
					)) : (
						<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, padding: '22px 10px 12px', textAlign: 'center' }}>
							<svg width="30" height="36" viewBox="0 0 26 30" fill="none" style={{ opacity: .7 }}>
								<path d="M13 2 L17 9 L9 9 Z" fill="#f0d9a8" />
								<rect x="10" y="9" width="6" height="14" fill="none" stroke="rgba(147,160,232,.6)" strokeWidth="1.4" />
								<path d="M10 13 h6 M10 17 h6" stroke="rgba(147,160,232,.6)" strokeWidth="1.4" />
								<path d="M6 27 q7 -4 14 0" stroke="rgba(147,160,232,.5)" strokeWidth="1.4" fill="none" />
							</svg>
							<span style={{ fontSize: 15, color: 'var(--text-soft)', fontStyle: 'italic', lineHeight: 1.6, maxWidth: 340 }}>
								No flares yet. When a visitor opens a hobby's bearing card on the chart and sends one up, it lands here, so the keeper knows which ship the coast wants back.
							</span>
						</div>
					)}

					<div style={{ borderTop: '1px solid rgba(150,160,220,.12)', marginTop: 12, paddingTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)', lineHeight: 1.6 }}>
						// one flare is one visitor, fired from a bearing card on the hobby chart. the coast votes with light.
					</div>
				</div>
			</div>
		</div>
	);
}
