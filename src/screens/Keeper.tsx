// The keeper's papers. Nine profile fields living on the user document,
// saved as you type. Never sends role; the server strips it anyway.
// The masthead card sits here too (the canon's placement), but it edits the
// copy singleton's gazette key, not the user doc: it rides the flag locker's
// debounced copy autosave (h.setGazette), the one place SiteCopy actually saves.
import { useHarbor } from '../state/harbor';
import type { KeeperProfile } from '../lib/api';
import { greeting } from '../lib/whimsy';
import CatPerch from '../components/CatPerch';

const CAT_QUIPS = ['the name field is warm.', 'justin, and also me.', 'sign it: the cat.'];

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
					<div style={{ position: 'relative' }}>
						<CatPerch quips={CAT_QUIPS} pose="lying" style={{ top: 2, right: 8 }} />
						<KeeperField field="name" label="name · what the harbor calls you" className="input--display" style={{ fontSize: 17 }} />
					</div>
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

					<div className="fieldset-dashed">
						<span className="field-label" style={{ letterSpacing: '.12em', color: 'var(--periwinkle)' }}>the gull post · masthead</span>
						<label className="field">
							<span className="field-label">volume line</span>
							<input type="text" className="input" style={{ padding: '10px 12px' }} placeholder="vol. XXXIX · harbor edition"
								value={h.copy.gazette?.vol ?? ''} onChange={(e) => h.setGazette({ vol: e.target.value })} />
						</label>
						<label className="field">
							<span className="field-label">notices · the keeper is presently...</span>
							<textarea className="input input--serif" rows={2} style={{ padding: '10px 12px' }}
								placeholder="wrangling the ArcXP migration (in flight, no page yet)"
								value={h.copy.gazette?.presently ?? ''} onChange={(e) => h.setGazette({ presently: e.target.value })} />
						</label>
						<span className="footnote" style={{ lineHeight: 1.7 }}>
							// the paper reads its folio and notices from here. each story is dressed on its own light.
						</span>
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
