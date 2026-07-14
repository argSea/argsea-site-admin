// The operator's own private welcome for a botched hail: every failed login
// floods the door with autoplaying rickrolls, and they tile denser with each
// miss (1, then 4, then 9 ...). No close button by ruling; a page reload is the
// only way out, the keeper's own escape hatch. This is whimsy on our own tool,
// not on anyone else. The admin has no CSP, so the youtube iframes just load.

// The official video. autoplay + loop (loop needs the playlist param set to the
// same id); no mute param, because sound is the intent ("overdo it"). If the
// browser's autoplay policy refuses sound the frame still mounts, and the click
// that failed the hail usually counts as the gesture that unlocks it.
const VIDEO_ID = 'dQw4w9WgXcQ';
const SRC = `https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&loop=1&playlist=${VIDEO_ID}&controls=0&rel=0`;

export default function RickFlood({ misses }: { misses: number }) {
	if (misses <= 0) {
		return null;
	}
	// misses × misses frames: a square tiling that multiplies with every miss.
	const frames = misses * misses;
	return (
		<div style={{
			position: 'fixed', inset: 0, zIndex: 40, background: '#000',
			display: 'grid',
			gridTemplateColumns: `repeat(${misses}, 1fr)`,
			gridTemplateRows: `repeat(${misses}, 1fr)`,
		}}>
			{Array.from({ length: frames }, (_, i) => (
				<iframe key={i} src={SRC} title="never gonna give you up"
					allow="autoplay; encrypted-media"
					style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />
			))}
		</div>
	);
}
