import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

test('dragging a light on the coast, then pinning it, sends percent coords keyed by id with rotation passed through', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	await page.getByText('the coast', { exact: true }).click();

	const canvas = page.locator('.coast-canvas');
	await expect(canvas).toBeVisible();
	const lamp = page.locator('.coast-lamp', { hasText: 'The Great Un-monolithing' });
	await expect(lamp).toBeVisible();

	const canvasBox = await canvas.boundingBox();
	const lampBox = await lamp.boundingBox();
	if (!canvasBox || !lampBox) {
		throw new Error('missing bounding box');
	}

	// drag the lamp to a new spot on the canvas
	await page.mouse.move(lampBox.x + lampBox.width / 2, lampBox.y + lampBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.35, { steps: 6 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'pin it' }).click();
	await expect(toast(page)).toHaveText('📌 the coast was pinned');

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
	// the coast never edits rotation; an unplaced light carries its legacy default through untouched
	expect(moved!.rotation).toBe(0);
});

test('tidy into rows resets the local layout without touching the API', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	await page.getByText('the coast', { exact: true }).click();

	await page.getByText('↺ tidy into rows').click();
	await expect(toast(page)).toHaveText('↺ the coast was tidied into a row');
	expect(mock.find('PUT', /^\/1\/project\/arrangement$/)).toHaveLength(0);
});

test('only published lights land on the coast', async ({ page }) => {
	await signIn(page);
	await nav(page, 'projects').click();
	await page.getByText('the coast', { exact: true }).click();

	// p1, p2, p4 are published; p3 (The home lab) is a draft
	await expect(page.locator('.coast-lamp')).toHaveCount(3);
	await expect(page.locator('.coast-lamp', { hasText: 'The home lab' })).toHaveCount(0);
});

test('an existing wall position rides through as the coast placement, rotation included', async ({ page }) => {
	const mock = new MockApi();
	mock.projects.find((p) => p.id === 'p4')!.wallPos = { x: 61, y: 24, rotation: -4.2 };
	await signIn(page, mock);
	await nav(page, 'projects').click();
	await page.getByText('the coast', { exact: true }).click();

	await page.getByRole('button', { name: 'pin it' }).click();
	await expect(toast(page)).toHaveText('📌 the coast was pinned');

	const [put] = mock.find('PUT', /^\/1\/project\/arrangement$/);
	const placements: { id: string; x: number; y: number; rotation: number }[] = put.body.placements;
	const p4 = placements.find((p) => p.id === 'p4');
	expect(p4).toBeTruthy();
	expect(p4!.x).toBeCloseTo(61, 0);
	expect(p4!.y).toBeCloseTo(24, 0);
	expect(p4!.rotation).toBe(-4.2);
});
