// The office shell. One screen state, no router — exactly like the design:
// login gate, sidebar + main pane, the two overlays, one toast.
import { useState } from 'react';
import { useHarbor } from './state/harbor';
import type { Screen } from './state/harbor';
import { useEscapeKey } from './lib/useEscapeKey';
import { PROVERBS } from './lib/whimsy';
import Login from './screens/Login';
import Bridge from './screens/Bridge';
import Postcards from './screens/Postcards';
import Graveyard from './screens/Graveyard';
import WritingDesk from './screens/WritingDesk';
import SignalFlags from './screens/SignalFlags';
import SmugglersHold from './screens/SmugglersHold';
import FigureheadShop from './screens/FigureheadShop';
import Darkroom from './screens/Darkroom';
import Keeper from './screens/Keeper';
import Sidebar from './components/Sidebar';
import EditOverlay from './components/EditOverlay';
import PeekOverlay from './components/PeekOverlay';
import { DriftDot } from './components/art';

const SCREENS: Record<Screen, () => React.JSX.Element> = {
	dash:     Bridge,
	projects: Postcards,
	hobbies:  Graveyard,
	notes:    WritingDesk,
	copy:     SignalFlags,
	eggs:     SmugglersHold,
	shop:     FigureheadShop,
	media:    Darkroom,
	keeper:   Keeper,
};

export default function App() {
	const h = useHarbor();
	const [proverbIdx, setProverbIdx] = useState(0);

	// Escape peels overlays back one at a time: peek first, then the edit
	useEscapeKey(Boolean(h.peek || h.edit), () => (h.peek ? h.closePeek() : h.cancelEdit()));

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
			<div style={{ display: 'flex', minHeight: '100vh', alignItems: 'stretch' }}>
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

			{h.edit && <EditOverlay />}
			{h.peek && <PeekOverlay />}
			{h.toast && <div className="toast">{h.toast}</div>}
		</>
	);
}
