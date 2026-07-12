import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('retiring a hobby PUTs the full doc with active flipped and the disposition set to laid to rest', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.locator('.content-row', { hasText: 'CachyOS tinkering' }).getByText('retire †').click();
	await expect(toast(page)).toHaveText('† laid to rest. gently.');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h2$/);
	expect(put.body.active).toBe(false);
	expect(put.body.disposition).toBe('laid to rest');
	expect(put.body.name).toBe('CachyOS tinkering');
	// epitaph/eulogy are dormant now: full-replace still carries them through untouched
	expect(put.body.eulogy).toBeTruthy();

	// it moved to the resting group, where the revive chip lives
	await expect(page.locator('.content-row--alt', { hasText: 'CachyOS tinkering' }).getByText('revive ↺')).toBeVisible();
});

test('reviving sets the disposition to still on watch', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.locator('.content-row', { hasText: 'Piano' }).getByText('revive ↺').click();
	await expect(toast(page)).toHaveText('↺ back from the graveyard');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.active).toBe(true);
	expect(put.body.disposition).toBe('still on watch');
});

test('reorder stays inside the group and swaps orders via PUT (hobbies snapshot nothing)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.locator('.content-row', { hasText: 'The home lab' }).getByTitle('move down').click();
	await expect(page.locator('.content-row .row-title').first()).toHaveText('CachyOS tinkering');

	const puts = mock.calls.filter((c) => c.method === 'PUT' && /^\/1\/hobby\//.test(c.path));
	expect(puts).toHaveLength(2);
	expect(puts.find((c) => c.path.endsWith('h1'))?.body.order).toBe(2);
	expect(puts.find((c) => c.path.endsWith('h2'))?.body.order).toBe(1);

	// moving the last resting hobby down goes nowhere and calls nothing
	mock.calls.length = 0;
	await page.locator('.content-row', { hasText: 'Running' }).getByTitle('move down').click();
	expect(mock.calls.filter((c) => c.method === 'PUT')).toHaveLength(0);
});

test('the suggestion pool feeds and un-tempts fate', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.getByPlaceholder('blacksmithing? kayaking?').fill('chess');
	await page.getByRole('button', { name: '+ tempt fate' }).click();
	await expect(toast(page)).toHaveText('the pool deepens');
	// the chip gains its question mark on the way in
	expect(mock.find('POST', /^\/1\/suggestion\/$/)[0].body).toEqual({ value: 'chess?' });
	await expect(page.locator('.sway-chip', { hasText: 'chess?' })).toBeVisible();

	await page.locator('.sway-chip', { hasText: 'kayaking?' }).locator('.chip-x').click();
	await expect(toast(page)).toHaveText('fate un-tempted');
	expect(mock.find('DELETE', /^\/1\/suggestion\/s2$/)).toHaveLength(1);
});

test('a new hobby enters the cycle, marker hidden while still learning', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();
	await page.getByRole('button', { name: '+ pick something up' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('keeper (hobby)').fill('Sourdough');
	await overlay.getByLabel(/^from the log/).fill('It is bread. It is alive. It is a lot.');
	// a fresh hobby starts "still learning": the marker picker stays hidden
	await expect(overlay.getByText('the living don\'t get markers')).toBeVisible();
	await expect(overlay.getByText('stone', { exact: true })).toHaveCount(0);

	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('† a new hobby enters the cycle');
	const [create] = mock.find('POST', /^\/1\/hobby\/$/);
	expect(create.body.name).toBe('Sourdough');
	expect(create.body.active).toBe(true);
	expect(create.body.log).toBe('It is bread. It is alive. It is a lot.');
	await expect(page.locator('.content-row', { hasText: 'Sourdough' })).toBeVisible();
});

test('the standing toggle flips disposition and reveals the marker picker + wear slider once at rest', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();
	await page.locator('.content-row', { hasText: 'The home lab' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('● still learning')).toBeVisible();
	await overlay.getByText('● still learning').click();
	await expect(overlay.getByText('❦ at rest')).toBeVisible();
	await expect(overlay.getByLabel(/^disposition/)).toHaveValue('laid to rest');

	// resting: the marker chips and weathering slider appear
	await overlay.getByText('driftwood', { exact: true }).click();
	await overlay.locator('input[type="range"]').fill('0.5');
	await expect(overlay.getByText('weathering · 50%')).toBeVisible();

	await overlay.getByRole('button', { name: 'save changes' }).click();
	const [put] = mock.find('PUT', /^\/1\/hobby\/h1$/);
	expect(put.body.active).toBe(false);
	expect(put.body.disposition).toBe('laid to rest');
	expect(put.body.marker).toBe('driftwood');
	expect(put.body.wear).toBe(0.5);
});
