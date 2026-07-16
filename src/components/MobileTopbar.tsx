// The phone topbar: the mock's collapsed companion to the desktop rail, off the
// same nav data. It carries the deploy verb and the way ashore; the lantern's
// status gauge and rollback stay desktop-only (ratified), so the phone gets the
// button, not the panel. CSS-hidden above the phone line (App.css).
import { Fragment } from 'react';
import { useHarbor } from '../state/harbor';
import { NAV_ITEMS } from '../lib/nav';
import { LighthouseMark } from './art';

export default function MobileTopbar() {
	const h = useHarbor();

	return (
		<header className="office-topbar">
			<div className="office-topbar__row">
				<div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
					<LighthouseMark width={20} height={24} style={{ transform: 'rotate(-4deg)' }} />
					<div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-nav)' }}>argsea</span>
						<span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '.1em', color: 'var(--periwinkle-deep)', textTransform: 'uppercase' }}>lighthouse keeper</span>
					</div>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<button className="btn btn--gold topbar-deploy" onClick={h.hoistLantern}>hoist the lantern</button>
					<span className="topbar-ashore" title="go ashore" onClick={h.goAshore}>⏏</span>
				</div>
			</div>
			<div className="office-topbar__nav">
				{NAV_ITEMS.map((item) => (
					<Fragment key={item.id}>
						{/* the rail's horizontal rule turned upright for the chip strip */}
						{item.rule && <span className="topbar-rule" aria-hidden="true" />}
						<button
							className={`topbar-chip${h.screen === item.id ? ' topbar-chip--active' : ''}`}
							onClick={() => h.goTo(item.id)}>
							<span aria-hidden="true">{item.glyph}</span> {item.label}
						</button>
					</Fragment>
				))}
			</div>
		</header>
	);
}
