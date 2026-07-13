// The two-step new-log flow: pick the light a log belongs to, then start it
// from the standard log or a blank desk. A value-for-value translation of the
// mock's NEW LOG FLOW. Templates are fixed (ruling): the standard skeleton and
// the header seed both live in the harbor.
import { useHarbor } from '../state/harbor';
import { useEscapeKey } from '../lib/useEscapeKey';

const mono = 'var(--font-mono)';

const TEMPLATES: { id: 'standard' | 'blank'; name: string; blurb: string }[] = [
	{ id: 'standard', name: 'the standard log', blurb: 'the house structure: starting point, the shape of it, outcomes. amber gaps left to fill.' },
	{ id: 'blank', name: 'a blank desk', blurb: 'nothing but the header. build the body block by block.' },
];

export default function NewLogFlow() {
	const h = useHarbor();
	const nf = h.logNew;
	useEscapeKey(Boolean(nf), h.cancelNewLog);
	if (!nf) {
		return null;
	}

	const pickedTitle = h.projects.find((p) => p.id === nf.projectId)?.title ?? '';

	return (
		<div onClick={h.cancelNewLog} style={{
			position: 'fixed', inset: 0, zIndex: 76, background: 'rgba(8,10,20,.72)', backdropFilter: 'blur(5px)',
			display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(14px,3vw,40px)', animation: 'backdropIn .25s ease both',
		}}>
			<div onClick={(e) => e.stopPropagation()} style={{
				width: 'min(560px,100%)', maxHeight: '86vh', overflow: 'auto', background: 'var(--overlay-card)',
				border: '1px solid var(--border-card)', borderRadius: 14, padding: 'clamp(22px,4vw,30px)', boxSizing: 'border-box',
				boxShadow: '0 30px 80px rgba(0,0,0,.6)', display: 'flex', flexDirection: 'column', gap: 16, animation: 'overlayIn .35s ease both',
			}}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
					<span style={{ fontFamily: mono, fontSize: 11.5, letterSpacing: '.14em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>a new full log</span>
					<span onClick={h.cancelNewLog} className="pill">close ✕</span>
				</div>

				{nf.step === 'light' && (
					<>
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--text-strong)' }}>Which light is this a log for?</span>
						<span style={{ fontSize: 14.5, color: 'var(--text-body)', fontStyle: 'italic' }}>A log belongs to one light. Lights already carrying a lit log are marked; publishing will swap it.</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
							{h.projects.map((p) => {
								const hasLit = h.logs.some((l) => l.projectId === p.id && l.status === 'published');
								return (
									<div key={p.id} onClick={() => h.pickNewLight(p.id)} style={{
										display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '13px 15px',
										borderRadius: 10, cursor: 'pointer', border: '1px solid rgba(150,160,220,.2)', background: 'var(--card-alt)',
									}}>
										<span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
											<span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text-head)' }}>{p.title}</span>
											<span style={{ fontFamily: mono, fontSize: 10.5, color: 'var(--periwinkle-deep)' }}>no. {h.regNo(p.id)}</span>
										</span>
										{hasLit && (
											<span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--gold)', border: '1px solid rgba(240,217,168,.5)', borderRadius: 999, padding: '3px 9px' }}>has a lit log</span>
										)}
									</div>
								);
							})}
						</div>
					</>
				)}

				{nf.step === 'template' && (
					<>
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 23, color: 'var(--text-strong)' }}>Start from a template</span>
						<span style={{ fontSize: 14.5, color: 'var(--text-body)', fontStyle: 'italic' }}>For {pickedTitle}. The header seeds from the light either way.</span>
						<div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 4 }}>
							{TEMPLATES.map((t) => {
								const on = nf.template === t.id;
								return (
									<div key={t.id} onClick={() => h.pickTemplate(t.id)} style={{
										display: 'flex', flexDirection: 'column', gap: 7, padding: '16px 18px', borderRadius: 12, cursor: 'pointer',
										border: on ? '1.5px dashed var(--gold-hover)' : '1px solid var(--border-input)',
										background: on ? 'rgba(240,217,168,.07)' : 'var(--card-alt)',
									}}>
										<span style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--text-head)' }}>{t.name}</span>
										<span style={{ fontSize: 13.5, color: 'var(--text-body)', lineHeight: 1.5 }}>{t.blurb}</span>
									</div>
								);
							})}
						</div>
						<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
							<span onClick={h.backToLights} style={{ cursor: 'pointer', fontFamily: mono, fontSize: 12, color: 'var(--text-body)' }}>← pick another light</span>
							<button onClick={() => { void h.createLog(); }} style={{ padding: '11px 20px', background: 'var(--gold)', color: 'var(--btn-text-gold)', border: 'none', borderRadius: 8, fontFamily: mono, fontSize: 12.5, boxShadow: '2px 2px 0 rgba(147,160,232,.6)', cursor: 'pointer' }}>open the desk →</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
