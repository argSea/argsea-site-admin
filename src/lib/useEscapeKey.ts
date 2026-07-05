import { useEffect, useRef } from 'react';

/**
 * Overlays close on Escape; listen only while one is open. The callback lives
 * in a ref so the listener attaches once per open/close cycle instead of
 * re-subscribing every render (callers pass fresh closures).
 */
export function useEscapeKey(active: boolean, onEscape: () => void): void {
	const callback = useRef(onEscape);
	callback.current = onEscape;

	useEffect(() => {
		if (!active) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				callback.current();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [active]);
}
