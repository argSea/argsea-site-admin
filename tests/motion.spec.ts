import { test, expect } from '@playwright/test';
import { signIn } from './office';

test.use({ contextOptions: { reducedMotion: 'reduce' } });

test('prefers-reduced-motion kills every animation and transition', async ({ page }) => {
	await signIn(page);

	// a drifting harbor light, pure decoration, animated by default
	const dot = page.locator('.drift-dot').first();
	expect(await dot.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

	// a tilted card keeps its resting pose but loses its transition
	const card = page.locator('.tilt').first();
	const style = await card.evaluate((el) => {
		const computed = getComputedStyle(el);
		return { transition: computed.transitionDuration, transform: computed.transform };
	});
	expect(style.transition.split(',').every((d) => d.trim() === '0s')).toBe(true);
	expect(style.transform).not.toBe('none');
});
