import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('a new postcard is filed as a draft with a <p>-wrapped body and a valid stamp', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.getByRole('button', { name: '+ new postcard' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('Test Card');
	await overlay.getByLabel('front of card · short description').fill('a card for testing');
	await overlay.getByLabel('back of card · the full story').fill('para one\n\npara two');
	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('✉ new postcard in the rack');
	await expect(page.getByText('Test Card')).toBeVisible();

	const [create] = mock.find('POST', /^\/1\/project\/$/);
	expect(create.body.title).toBe('Test Card');
	expect(create.body.status).toBe('draft');
	expect(create.body.body).toBe('<p>para one</p>\n<p>para two</p>');
	// fresh cards carry a surprise stamp — always inside the API's enums
	expect(['rect', 'circle']).toContain(create.body.stamp.shape);
	expect(['lighthouse', 'boat', 'sun', 'wave', 'moon', 'anchor', 'text']).toContain(create.body.stamp.motif);
	expect(['#f0d9a8', '#93a0e8']).toContain(create.body.stamp.ink);
});

test('editing a stampless card never invents a stamp ({} is invalid — omit entirely)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('The home lab, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✉ postcard filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p3$/);
	expect(put.body.title).toBe('The home lab, renamed');
	expect('stamp' in put.body).toBe(false);
	// full-replace: the complete document went over the wire
	expect(put.body.shortDesc).toBeTruthy();
	expect(put.body.tags.length).toBeGreaterThan(0);
});

test('the publish pill goes through the lifecycle endpoint, not PUT', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('○ draft').click();
	await expect(toast(page)).toHaveText('● stamped and published');
	await expect(row.getByText('● published')).toBeVisible();
	expect(mock.find('POST', /^\/1\/project\/p3\/publish$/)).toHaveLength(1);
	expect(mock.find('PUT', /^\/1\/project\/p3$/)).toHaveLength(0);
});

test('the mantel only fits three', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();

	// three seeded featured cards — a fourth is refused client-side
	const draftRow = page.locator('.content-row', { hasText: 'The home lab' });
	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('the mantel only fits three — take one down first');
	expect(mock.find('POST', /feature$/)).toHaveLength(0);

	// take one down from the mantel chips, then the spot is free
	await page.locator('.sway-chip', { hasText: 'Meo Wave Race' }).locator('.chip-x').click();
	await expect(toast(page)).toHaveText('☆ taken down from the mantel');
	expect(mock.find('POST', /^\/1\/project\/p2\/unfeature$/)).toHaveLength(1);

	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('★ up on the mantel');
	expect(mock.find('POST', /^\/1\/project\/p3\/feature$/)).toHaveLength(1);
});

test('moving a card down the rack swaps orders via two reorder calls', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();

	const titles = page.locator('.content-row .row-title');
	await expect(titles.first()).toHaveText('The Great Un-monolithing');

	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByTitle('move down the rack').click();
	await expect(titles.first()).toHaveText('Meo Wave Race');

	const reorders = mock.find('POST', /^\/1\/project\/[^/]+\/reorder$/);
	expect(reorders).toHaveLength(2);
	expect(reorders.find((c) => c.path.includes('p1'))?.body).toEqual({ order: 2 });
	expect(reorders.find((c) => c.path.includes('p2'))?.body).toEqual({ order: 1 });
});

test('scuttling takes two clicks', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });

	await row.getByText('scuttle', { exact: true }).click();
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(0);
	await row.getByText('sure? scuttle.').click();
	await expect(toast(page)).toHaveText('🌊 scuttled. the sea keeps its secrets.');
	await expect(row).toHaveCount(0);
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(1);
});
