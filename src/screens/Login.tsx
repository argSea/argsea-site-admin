// "State your name and business." Field checks match the design's microcopy;
// a rejected login gets the same lantern treatment.
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useHarbor } from '../state/harbor';
import { Boat, DriftDot, LighthouseMark } from '../components/art';

export default function Login() {
	const h = useHarbor();
	const [user, setUser] = useState('');
	const [pass, setPass] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [casting, setCasting] = useState(false);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (!user.trim()) {
			setError('the harbor needs a name.');
			return;
		}
		if (!pass) {
			setError('no passphrase, no lantern.');
			return;
		}
		setCasting(true);
		try {
			await h.signIn(user.trim(), pass);
		} catch {
			setError('the harbor does not know that name and passphrase.');
		} finally {
			setCasting(false);
		}
	};

	const inputStyle = { fontFamily: 'var(--font-mono)', fontSize: 14, padding: '12px 14px' } as const;

	return (
		<div style={{
			minHeight: '100vh', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
			padding: 'clamp(20px, 5vw, 52px)', boxSizing: 'border-box', overflow: 'hidden',
			color: 'var(--text-base)',
		}}>
			<DriftDot color="gold" size={5} duration="11s" style={{ right: '16%', top: '18%', boxShadow: '0 0 14px 4px rgba(240,217,168,.4)' }} />
			<DriftDot color="peri" duration="14s" delay="2s" style={{ left: '14%', top: '30%' }} />
			<DriftDot color="gold" duration="9s" delay="1s" style={{ left: '22%', bottom: '18%' }} />
			<DriftDot color="peri" duration="13s" delay="3s" style={{ right: '20%', bottom: '26%' }} />

			<div style={{
				position: 'absolute', right: 'clamp(24px, 8vw, 120px)', top: 64, width: 110, height: 110,
				border: '1.5px dashed rgba(147,160,232,.4)', borderRadius: '50%',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				animation: 'postmarkSway 9s ease-in-out infinite',
			}}>
				<div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.14em', color: 'var(--periwinkle)', lineHeight: 1.7 }}>
					CREW<br />ONLY ·<br />ARGSEA.COM
				</div>
			</div>

			<div style={{
				width: 'min(420px, 100%)', background: 'var(--card)', border: '1px solid var(--border-card)',
				borderRadius: 12, padding: 'clamp(28px, 5vw, 40px)', boxSizing: 'border-box',
				boxShadow: '0 10px 24px rgba(0,0,0,.35)', transform: 'rotate(-.8deg)',
				display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeUp .7s ease .05s both',
			}}>
				<div style={{ display: 'flex', justifyContent: 'center' }}>
					<LighthouseMark width={34} height={40} />
				</div>
				<div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
					<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, letterSpacing: '.14em', color: 'var(--periwinkle)', textTransform: 'uppercase' }}>argsea · crew only</span>
					<span style={{ fontFamily: 'var(--font-display)', fontSize: 27, color: 'var(--text-strong)', lineHeight: 1.2 }}>The Harbormaster's Office</span>
					<span style={{ fontSize: 15, color: 'var(--text-dim)', fontStyle: 'italic' }}>State your name and business.</span>
				</div>
				<form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: 0 }}>
					<input type="text" className="input" placeholder="who goes there?" autoComplete="username"
						value={user} onChange={(e) => { setUser(e.target.value); setError(null); }} style={inputStyle} />
					<input type="password" className="input" placeholder="passphrase" autoComplete="current-password"
						value={pass} onChange={(e) => { setPass(e.target.value); setError(null); }}
						style={{ ...inputStyle, letterSpacing: '.1em' }} />
					{error && (
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gold)' }}>{error}</span>
					)}
					<button type="submit" className="btn" disabled={casting} style={{ padding: '13px 24px', fontSize: 14 }}>
						unlock the office
					</button>
				</form>
				<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)', textAlign: 'center' }}>
					// tokens expire. whimsy doesn't.
				</span>
			</div>

			<div style={{ position: 'absolute', bottom: 52, left: -40, animation: 'sail 38s linear infinite', pointerEvents: 'none' }}>
				<Boat />
			</div>
			<div style={{ position: 'absolute', bottom: 22, left: 0, right: 0, textAlign: 'center' }} className="footnote">
				© 2026 · argsea.com · back office
			</div>
		</div>
	);
}
