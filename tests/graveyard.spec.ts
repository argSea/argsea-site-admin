import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('retiring a hobby PUTs the full doc with active flipped and a stand-in epitaph', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.locator('.content-row', { hasText: 'CachyOS tinkering' }).getByText('retire †').click();
	await expect(toast(page)).toHaveText('† laid to rest. gently.');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h2$/);
	expect(put.body.active).toBe(false);
	expect(put.body.epitaph).toBe('† resting');
	expect(put.body.name).toBe('CachyOS tinkering');
	expect(put.body.eulogy).toBeTruthy();

	// it moved to the resting group, where the revive chip lives
	await expect(page.locator('.content-row--alt', { hasText: 'CachyOS tinkering' }).getByText('revive ↺')).toBeVisible();
});

test('reviving clears the epitaph', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();

	await page.locator('.content-row', { hasText: 'Piano' }).getByText('revive ↺').click();
	await expect(toast(page)).toHaveText('↺ back from the graveyard');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.active).toBe(true);
	expect(put.body.epitaph).toBe('');
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

test('a new hobby enters the cycle', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the graveyard').click();
	await page.getByRole('button', { name: '+ pick something up' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('hobby').fill('Sourdough');
	await overlay.getByLabel('eulogy').fill('It is bread. It is alive. It is a lot.');
	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('† a new hobby enters the cycle');
	const [create] = mock.find('POST', /^\/1\/hobby\/$/);
	expect(create.body.name).toBe('Sourdough');
	expect(create.body.active).toBe(true);
	await expect(page.locator('.content-row', { hasText: 'Sourdough' })).toBeVisible();
});
