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

test('the last card selected floats above the order-based baseline', async ({ page }) => {
	await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	const zIndexOf = async (title: string) => {
		const card = page.locator('.wall-card', { hasText: title });
		return Number(await card.evaluate((el) => getComputedStyle(el).zIndex));
	};

	// order 1 sits on top of order 2 before anything is touched
	const baseline1 = await zIndexOf('The Great Un-monolithing');
	const baseline2 = await zIndexOf('Meo Wave Race');
	expect(baseline1).toBeGreaterThan(baseline2);

	// selecting the order-2 card floats it above order 1
	await page.locator('.wall-card', { hasText: 'Meo Wave Race' }).click();
	expect(await zIndexOf('Meo Wave Race')).toBeGreaterThan(await zIndexOf('The Great Un-monolithing'));

	// selecting order 1 next moves the float back onto it
	await page.locator('.wall-card', { hasText: 'The Great Un-monolithing' }).click();
	expect(await zIndexOf('The Great Un-monolithing')).toBeGreaterThan(await zIndexOf('Meo Wave Race'));
});

test('pin it persists the ghost placard through SiteCopy', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	const ghost = page.locator('.wall-ghost');
	await expect(ghost).toBeVisible();

	const canvas = page.locator('.project-wall');
	const canvasBox = await canvas.boundingBox();
	const ghostBox = await ghost.boundingBox();
	if (!canvasBox || !ghostBox) {
		throw new Error('missing bounding box');
	}

	// drag the ghost to a new spot, same pointer logic the cards use
	await page.mouse.move(ghostBox.x + ghostBox.width / 2, ghostBox.y + ghostBox.height / 2);
	await page.mouse.down();
	await page.mouse.move(canvasBox.x + canvasBox.width * 0.15, canvasBox.y + canvasBox.height * 0.2, { steps: 6 });
	await page.mouse.up();

	await page.getByRole('button', { name: 'pin it' }).click();
	await expect(toast(page)).toHaveText('📌 the wall arrangement is pinned');

	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBeGreaterThan(0);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	const wallGhost = put.body.wallGhost;
	expect(wallGhost).toBeTruthy();
	expect(wallGhost.enabled).toBe(true);
	expect(wallGhost.x).toBeGreaterThanOrEqual(0);
	expect(wallGhost.x).toBeLessThanOrEqual(100);
	expect(wallGhost.y).toBeGreaterThanOrEqual(0);
	expect(wallGhost.y).toBeLessThanOrEqual(100);
});

test('hiding the ghost placard persists as disabled', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	await page.getByTitle('hide the "out with the mail" placard').click();
	await expect(page.locator('.wall-ghost')).toHaveCount(0);

	await page.getByRole('button', { name: 'pin it' }).click();
	await expect(toast(page)).toHaveText('📌 the wall arrangement is pinned');

	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBeGreaterThan(0);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/).slice(-1);
	expect(put.body.wallGhost.enabled).toBe(false);
});

test('dragging a row in the stack list restacks the wall through reorder calls', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByText('the wall', { exact: true }).click();

	const rows = page.locator('.wall-order__row');
	await expect(rows).toHaveCount(3);
	// the three published cards land in saved order: p1, p2, p4
	await expect(rows.nth(0)).toContainText('The Great Un-monolithing');
	await expect(rows.nth(2)).toContainText('This website');

	// drag the bottom row (This website / p4) up to the top of the stack
	await rows.nth(2).dispatchEvent('dragstart', { bubbles: true });
	await rows.nth(0).dispatchEvent('dragover', { bubbles: true });
	await rows.nth(0).dispatchEvent('drop', { bubbles: true });

	await expect(rows.nth(0)).toContainText('This website');

	const reorders = () => mock.find('POST', /^\/1\/project\/[^/]+\/reorder$/);
	await expect.poll(() => reorders().length).toBeGreaterThan(0);

	// p4 was order 4, now sits on top as order 1
	const p4 = reorders().find((r) => /\/p4\//.test(r.path));
	expect(p4).toBeTruthy();
	expect(p4!.body.order).toBe(1);
});
