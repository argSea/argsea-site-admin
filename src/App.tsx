// The office shell. One screen state, no router: exactly like the design:
// login gate, sidebar + main pane, the two overlays, one toast. Below the
// drawer breakpoint the sidebar folds behind a hamburger in a slim top bar.
import { useEffect, useRef, useState } from 'react';
import { useHarbor } from './state/harbor';
import type { Screen } from './state/harbor';
import { useEscapeKey } from './lib/useEscapeKey';
import { PROVERBS } from './lib/whimsy';
import Login from './screens/Login';
import WatchRoom from './screens/WatchRoom';
import Projects from './screens/Projects';
import Graveyard from './screens/Graveyard';
import WritingDesk from './screens/WritingDesk';
import SignalFlags from './screens/SignalFlags';
import SmugglersCove from './screens/SmugglersCove';
import FigureheadShop from './screens/FigureheadShop';
import Marginalia from './screens/Marginalia';
import Darkroom from './screens/Darkroom';
import Keeper from './screens/Keeper';
import Sidebar from './components/Sidebar';
import EditOverlay from './components/EditOverlay';
import PeekOverlay from './components/PeekOverlay';
import { DriftDot, LighthouseMark } from './components/art';
import './App.css';

// The phone breakpoint, mirrors the site's hamburger ruling. Keep in sync
// with the media query in App.css.
const DRAWER_MAX = 600;

const SCREENS: Record<Screen, () => React.JSX.Element> = {
	dash:       WatchRoom,
	projects:   Projects,
	hobbies:    Graveyard,
	notes:      WritingDesk,
	copy:       SignalFlags,
	eggs:       SmugglersCove,
	shop:       FigureheadShop,
	marginalia: Marginalia,
	media:      Darkroom,
	keeper:     Keeper,
};

export default function App() {
	const h = useHarbor();
	const [proverbIdx, setProverbIdx] = useState(0);
	const [navOpen, setNavOpen] = useState(false);
	const burger = useRef<HTMLButtonElement>(null);

	const closeNav = () => setNavOpen(false);

	// Dismissals that don't land focus anywhere (Escape, backdrop) hand it back
	// to the toggle; a nav tap switches screens, so plain close is enough there
	const dismissNav = () => {
		closeNav();
		burger.current?.focus();
	};

	// Escape peels the chrome back one layer at a time: the drawer first, then
	// the peek, then the edit
	useEscapeKey(Boolean(navOpen || h.peek || h.edit), () => {
		if (navOpen) {
			dismissNav();
		} else if (h.peek) {
			h.closePeek();
		} else {
			h.cancelEdit();
		}
	});

	// A jump past the breakpoint leaves no way to close the drawer, so drop it.
	// Watch the exact query App.css uses; a mirrored min-width would leave a
	// fractional-width gap between the two where neither side fires.
	useEffect(() => {
		const phone = window.matchMedia(`(max-width: ${DRAWER_MAX}px)`);
		const onChange = () => { if (!phone.matches) { setNavOpen(false); } };
		phone.addEventListener('change', onChange);
		return () => phone.removeEventListener('change', onChange);
	}, []);

	if (h.booting) {
		return null;
	}

	if (!h.session) {
		return (
			<>
				<Login />
				{h.toast && <div className="toast">{h.toast}</div>}
			</>
		);
	}

	const Screen = SCREENS[h.screen];

	return (
		<>
			<div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
				<header className="office-topbar">
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<LighthouseMark width={20} height={24} style={{ transform: 'rotate(-4deg)' }} />
						<span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--text-nav)' }}>argsea</span>
					</div>
					<button
						ref={burger}
						className="office-burger"
						aria-label={navOpen ? 'close the sidebar' : 'open the sidebar'}
						aria-expanded={navOpen}
						aria-controls="office-sidebar"
						onClick={() => setNavOpen((prev) => !prev)}
					>
						<span className={`office-burger__box${navOpen ? ' office-burger__box--open' : ''}`}>
							<span className="office-burger__bar" />
							<span className="office-burger__bar" />
							<span className="office-burger__bar" />
						</span>
					</button>
				</header>

				<div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
					<Sidebar open={navOpen} onNavigate={closeNav} />

					<div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
						<DriftDot color="gold" duration="12s" style={{ right: '12%', top: '10%' }} />
						<DriftDot color="peri" size={3} duration="15s" delay="3s" style={{ left: '8%', top: '38%' }} />
						<DriftDot color="gold" size={3} duration="10s" delay="1.5s" style={{ right: '22%', bottom: '16%' }} />

						<div style={{
							flex: 1, padding: 'clamp(28px, 4vw, 48px) var(--gutter) 24px', boxSizing: 'border-box',
							maxWidth: 1060, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 26,
						}}>
							<Screen />
						</div>

						<div style={{
							display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
							gap: 12, padding: '20px var(--gutter) 22px', borderTop: '1px solid rgba(150,160,220,.1)',
						}}>
							<span className="footnote">© 2026 · argsea.com · back office</span>
							<span className="proverb" title="crack another proverb"
								onClick={() => setProverbIdx((i) => i + 1)}>
								{PROVERBS[proverbIdx % PROVERBS.length]} ↻
							</span>
							<span className="footnote">signed in as {h.keeperName} · jwt, allegedly</span>
						</div>
					</div>
				</div>
			</div>

			{navOpen && <div className="office-drawer-backdrop" onClick={dismissNav} />}
			{h.edit && <EditOverlay />}
			{h.peek && <PeekOverlay />}
			{h.toast && <div className="toast">{h.toast}</div>}
		</>
	);
}
