// The chart table: the one surface where every chartable gets its berth. Lights,
// hobbies and journal notes are laid out together on the Helm's own window,
// because they land on one chart and placing them apart was how a light and a
// note ended up on top of each other.
import ChartSurface from '../components/ChartSurface';
import CatPerch from '../components/CatPerch';

const CAT_QUIPS = [
	'i have walked across this one twice.', 'the notes drift. i deny involvement.', 'nothing is where you left it.',
];

export default function ChartTable() {
	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 22, position: 'relative', paddingBottom: 44 }}>
			<CatPerch quips={CAT_QUIPS} pose="standing" style={{ bottom: -6, right: 18 }} />
			<div className="screen-head">
				<div className="screen-head__text">
					<span className="kicker">chart room</span>
					<span className="page-title">The chart table</span>
					<span className="page-sub">
						Every light, hobby and note that carries a berth, laid out on the Helm's own window. Drag them where they belong, pick the print that leads, write the line under it.
					</span>
				</div>
			</div>

			<ChartSurface lens="all" />
		</div>
	);
}
