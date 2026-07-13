// The office shell. One screen state, no router, exactly like the design: login
// gate, sidebar + main pane, the overlays, one toast. Below the phone line the
// sidebar hides and a sticky MobileTopbar stands in (parallel DOM off the same
// nav data, the SPA exception to the site's reflow rule).
import { useState } from 'react';
import { useHarbor } from './state/harbor';
import type { Screen } from './state/harbor';
import { useEscapeKey } from './lib/useEscapeKey';
import { PROVERBS } from './lib/whimsy';
import Login from './screens/Login';
import WatchRoom from './screens/WatchRoom';
import Projects from './screens/Projects';
import ShipsLog from './screens/ShipsLog';
import WritingDesk from './screens/WritingDesk';
import SignalFlags from './screens/SignalFlags';
import SmugglersCove from './screens/SmugglersCove';
import CarvingShop from './screens/CarvingShop';
import Marginalia from './screens/Marginalia';
import Darkroom from './screens/Darkroom';
import Keeper from './screens/Keeper';
import Sidebar from './components/Sidebar';
import MobileTopbar from './components/MobileTopbar';
import EditOverlay from './components/EditOverlay';
import PeekOverlay from './components/PeekOverlay';
import FlareRoll from './components/FlareRoll';
import LogDesk from './components/LogDesk';
import NewLogFlow from './components/NewLogFlow';
import PublishConfirm from './components/PublishConfirm';
import { DriftDot } from './components/art';
import './App.css';

const SCREENS: Record<Screen, () => React.JSX.Element> = {
	dash:       WatchRoom,
	projects:   Projects,
	hobbies:    ShipsLog,
	notes:      WritingDesk,
	copy:       SignalFlags,
	eggs:       SmugglersCove,
	shop:       CarvingShop,
	marginalia: Marginalia,
	media:      Darkroom,
	keeper:     Keeper,
};

export default function App() {
	const h = useHarbor();
	const [proverbIdx, setProverbIdx] = useState(0);

	// Escape peels the chrome back one layer at a time: the flares roll call
	// first (it opens over the watch room), then the peek, then the edit.
	useEscapeKey(Boolean(h.flareRoll || h.peek || h.edit), () => {
		if (h.flareRoll) {
			h.closeFlareRoll();
		} else if (h.peek) {
			h.closePeek();
		} else {
			h.cancelEdit();
		}
	});

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
				<MobileTopbar />

				<div style={{ display: 'flex', flex: 1, alignItems: 'stretch' }}>
					<Sidebar />

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

			{h.edit && <EditOverlay />}
			{h.peek && <PeekOverlay />}
			{h.flareRoll && <FlareRoll />}
			{h.desk && <LogDesk />}
			{h.logNew && <NewLogFlow />}
			{h.logConfirm && <PublishConfirm />}
			{h.toast && <div className="toast">{h.toast}</div>}
		</>
	);
}
