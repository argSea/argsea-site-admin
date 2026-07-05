// The keeper's papers. Nine profile fields living on the user document,
// saved as you type. Never sends role — the server strips it anyway.
import { useHarbor } from '../state/harbor';
import type { KeeperProfile } from '../lib/api';
import { greeting } from '../lib/whimsy';

interface FieldProps {
	field:      keyof KeeperProfile;
	label:      string;
	className?: string;
	style?:     React.CSSProperties;
	placeholder?: string;
	rows?:      number;
}

function KeeperField({ field, label, className = 'input--soft', style, placeholder, rows }: FieldProps) {
	const h = useHarbor();
	const shared = {
		value: h.keeper[field],
		placeholder,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => h.setKeeperField(field, e.target.value),
	};

	return (
		<label className="field">
			<span className="field-label">{label}</span>
			{rows
				? <textarea className={`input ${className}`} rows={rows} style={style} {...shared} />
				: <input type="text" className={`input ${className}`} style={style} {...shared} />}
		</label>
	);
}

export default function Keeper() {
	const h = useHarbor();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
			<div className="screen-head__text" style={{ animation: 'fadeUp .7s ease .05s both' }}>
				<span className="kicker">the keeper's papers</span>
				<span className="page-title">Who's running this lighthouse</span>
				<span className="page-sub">The office uses these to address you properly, whatever your login says.</span>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22, alignItems: 'start', animation: 'fadeUp .7s ease .15s both' }}>
				<div className="card tilt" style={{ '--tilt': '-.3deg', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
					<span className="card-kicker">identity papers</span>
					<KeeperField field="name" label="name · what the harbor calls you" className="input--display" style={{ fontSize: 17 }} />
					<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
						<KeeperField field="pronouns" label="pronouns" placeholder="he/him" />
						<KeeperField field="location" label="home port" />
					</div>
					<KeeperField field="title" label="day job · rank" className="input--serif" style={{ padding: '10px 12px' }} />
					<KeeperField field="bio" label="the short version · one-line bio" className="input--serif" rows={3} style={{ padding: '10px 12px' }} />
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
					<div className="card tilt" style={{ '--tilt': '.3deg', display: 'flex', flexDirection: 'column', gap: 14 } as React.CSSProperties}>
						<span className="card-kicker">lines ashore</span>
						<KeeperField field="email" label="email" />
						<KeeperField field="github" label="github" />
						<KeeperField field="linkedin" label="linkedin" />
						<KeeperField field="signoff" label="sign-off · how notes end" style={{ color: 'var(--periwinkle)' }} />
					</div>

					<div className="card card--gold tilt" style={{ '--tilt': '-.3deg', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 8 } as React.CSSProperties}>
						<span className="card-kicker card-kicker--gold">how the office sees you</span>
						<span style={{ fontSize: 15.5, color: 'var(--text-base)', lineHeight: 1.6 }}>
							"{greeting()}, <span style={{ color: 'var(--gold)' }}>{h.keeperName}</span>."
						</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--periwinkle-deep)' }}>
							// greetings, the footer, and note sign-offs all read from these papers.
						</span>
					</div>
				</div>
			</div>

			<span className="footnote">// saved as you type. the lighthouse always knows its keeper.</span>
		</div>
	);
}
