// The flag locker. The SiteCopy singleton, field for field — five footer
// quips, the hero, and the dictionary entry. Saved as you type (debounced PUT).
import { useHarbor } from '../state/harbor';
import type { SiteCopy } from '../lib/api';

const QUIP_FIELDS: { key: keyof SiteCopy; label: string }[] = [
	{ key: 'quipHello', label: 'hello' },
	{ key: 'quipProjects', label: 'projects' },
	{ key: 'quipHobbies', label: 'hobbies' },
	{ key: 'quipNotes', label: 'notes' },
	{ key: 'quip404', label: '404' },
];

export default function SignalFlags() {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the flag locker</span>
				<span className="page-title">Signal flags</span>
				<span className="page-sub">The little lines of copy that fly over every page.</span>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start', animation: 'fadeUp .7s ease .15s both' }}>
				<div className="card tilt" style={{ '--tilt': '-.3deg', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
					<span className="card-kicker">footer quips · one per page</span>
					{QUIP_FIELDS.map((field) => (
						<label key={field.key} className="field">
							<span className="field-label">{field.label}</span>
							<input type="text" className="input input--serif-italic" style={{ padding: '10px 12px' }}
								value={h.copy[field.key]}
								onChange={(e) => h.setCopyField(field.key, e.target.value)} />
						</label>
					))}
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
					<div className="card tilt" style={{ '--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
						<span className="card-kicker">the hero</span>
						<label className="field">
							<span className="field-label">kicker</span>
							<input type="text" className="input" style={{ padding: '10px 12px', fontSize: 12.5, letterSpacing: '.08em' }}
								value={h.copy.heroKicker}
								onChange={(e) => h.setCopyField('heroKicker', e.target.value)} />
						</label>
						<label className="field">
							<span className="field-label">headline</span>
							<input type="text" className="input" style={{ padding: '10px 12px', color: 'var(--text-strong)', fontFamily: 'var(--font-display)', fontSize: 17 }}
								value={h.copy.heroHeadline}
								onChange={(e) => h.setCopyField('heroHeadline', e.target.value)} />
						</label>
						<label className="field">
							<span className="field-label">intro</span>
							<textarea className="input input--serif" rows={3} style={{ padding: '10px 12px' }}
								value={h.copy.heroBody}
								onChange={(e) => h.setCopyField('heroBody', e.target.value)} />
						</label>
					</div>

					<div className="card card--alt tilt" style={{ '--tilt': '-.3deg', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
						<div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
							<span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--text-strong)' }}>argsea</span>
							<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--periwinkle-deep)' }}>/ˈɑːrɡ·siː/ · noun · the dictionary entry</span>
						</div>
						<textarea className="input input--serif" rows={4} style={{ padding: '10px 12px', lineHeight: 1.6 }}
							value={h.copy.dict}
							onChange={(e) => h.setCopyField('dict', e.target.value)} />
					</div>
				</div>
			</div>

			<span className="footnote">// saved as you type. flies on the next lantern hoist.</span>
		</div>
	);
}
