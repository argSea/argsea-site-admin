// Lighting a log confirms first: one lit log per light, so publishing swaps
// whatever is lit now. A value-for-value translation of the mock's PUBLISH
// CONFIRM. Nothing is public until the next hoist; this only decides what the
// build sees.
import { useHarbor } from '../state/harbor';
import { useEscapeKey } from '../lib/useEscapeKey';

const mono = 'var(--font-mono)';

export default function PublishConfirm() {
	const h = useHarbor();
	const confirm = h.logConfirm;
	useEscapeKey(Boolean(confirm), h.cancelPublish);
	if (!confirm) {
		return null;
	}

	const target = h.logs.find((l) => l.id === confirm.id);
	if (!target) {
		return null;
	}
	const current = h.logs.find((l) => l.projectId === target.projectId && l.status === 'published' && l.id !== target.id);
	const swapLine = current
		? `“${current.title}” is the lit log for this light. Publishing this one sends that one back to draft. Only one log stays lit per light.`
		: 'No other log is lit for this light, so this one takes the spot.';

	return (
		<div onClick={h.cancelPublish} style={{
			position: 'fixed', inset: 0, zIndex: 78, background: 'rgba(8,10,20,.78)', backdropFilter: 'blur(5px)',
			display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(14px,3vw,40px)', animation: 'backdropIn .25s ease both',
		}}>
			<div onClick={(e) => e.stopPropagation()} style={{
				width: 'min(480px,100%)', background: 'var(--overlay-card)', border: '1px solid var(--gold-dash-mid)', borderRadius: 14,
				padding: 'clamp(22px,4vw,30px)', boxSizing: 'border-box', boxShadow: '0 30px 80px rgba(0,0,0,.6)',
				display: 'flex', flexDirection: 'column', gap: 14, animation: 'overlayIn .35s ease both',
			}}>
				<span style={{ fontFamily: mono, fontSize: 11.5, letterSpacing: '.14em', color: 'var(--gold)', textTransform: 'uppercase' }}>light this log</span>
				<span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--text-strong)', lineHeight: 1.2 }}>Publish "{target.title}"?</span>
				<span style={{ fontSize: 15, color: 'var(--text-body)', lineHeight: 1.6 }}>{swapLine}</span>
				<span style={{ fontFamily: mono, fontSize: 11.5, color: 'var(--periwinkle-deep)', lineHeight: 1.6 }}>// nothing is public until the next hoist. publishing only decides what the build sees.</span>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
					<span onClick={h.cancelPublish} className="pill">not yet</span>
					<button onClick={() => { void h.confirmPublish(); }} style={{ padding: '10px 20px', background: 'var(--gold)', color: 'var(--btn-text-gold)', border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 12.5, boxShadow: '2px 2px 0 rgba(147,160,232,.6)', cursor: 'pointer' }}>yes, light it</button>
				</div>
			</div>
		</div>
	);
}
