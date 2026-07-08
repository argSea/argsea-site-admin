import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('dragging and tilting a wall card, then pinning it, sends percent coords keyed by id', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	const canvas = page.locator('.project-wall');
	await expect(canvas).toBeVisible();
	const card = page.locator('.wall-card', { hasText: 'The Great Un-monolithing' });
	await expect(card).toBeVisible();

	const canvasBox = await canvas.boundingBox();
	const cardBox = await card.boundingBox();
	if (!canvasBox || !cardBox) {
		throw new Error('missing bounding box');
	}

	// drag the card to a new spot on the canvas
	await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.4, { steps: 6 });
	await page.mouse.up();

	// grab the rotate knob and tilt it
	const knob = card.locator('.wall-card__rotate');
	const knobBox = await knob.boundingBox();
	if (!knobBox) {
		throw new Error('missing rotate knob box');
	}
	await page.mouse.move(knobBox.x + knobBox.width / 2, knobBox.y + knobBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(knobBox.x + knobBox.width / 2 + 20, knobBox.y + knobBox.height / 2 - 20, { steps: 6 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'pin it' }).click();
	await expect(toast(page)).toHaveText('📌 the wall arrangement is pinned');

	const [put] = mock.find('PUT', /^\/1\/project\/arrangement$/);
	expect(put).toBeTruthy();
	const placements: { id: string; x: number; y: number; rotation: number }[] = put.body.placements;
	expect(placements.length).toBeGreaterThan(0);
	const moved = placements.find((p) => p.id === 'p1');
	expect(moved).toBeTruthy();
	expect(moved!.x).toBeGreaterThanOrEqual(0);
	expect(moved!.x).toBeLessThanOrEqual(100);
	expect(moved!.y).toBeGreaterThanOrEqual(0);
	expect(moved!.y).toBeLessThanOrEqual(100);
	expect(moved!.rotation).not.toBe(0);
	expect(Math.abs(moved!.rotation)).toBeLessThanOrEqual(30);
});

test('tidy into rows resets the local layout without touching the API', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	await page.getByText('↺ tidy into rows').click();
	await expect(toast(page)).toHaveText('↺ the wall was tidied into rows');
	expect(mock.find('PUT', /^\/1\/project\/arrangement$/)).toHaveLength(0);
});
