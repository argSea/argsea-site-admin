import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('a new light is filed as a draft, defaulting to fixed white and no gallery', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	await page.getByRole('button', { name: '+ kindle a light' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('Test Light');
	await overlay.getByLabel('front of card · short description').fill('a light for testing');
	await overlay.getByLabel('back of card · the full story').fill('para one\n\npara two');
	await overlay.getByRole('button', { name: 'file it' }).click();

	await expect(toast(page)).toHaveText('🕯 a light was kindled, into the rack');
	await expect(page.getByText('Test Light')).toBeVisible();

	const [create] = mock.find('POST', /^\/1\/project\/$/);
	expect(create.body.title).toBe('Test Light');
	expect(create.body.status).toBe('draft');
	expect(create.body.body).toBe('<p>para one</p>\n<p>para two</p>');
	expect(create.body.light).toEqual({ kind: 'fixed', color: 'white', period: 0, extinguished: '' });
	expect(create.body.images).toEqual([]);
	// the postcard-era fields are dormant now; a fresh light never invents any of them
	expect('stamp' in create.body).toBe(false);
	expect('postcardTo' in create.body).toBe(false);
	expect('image' in create.body).toBe(false);
});

test('editing a light preserves the dormant postcard-era fields (full-replace pass-through)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('The Great Un-monolithing, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	// none of these ride the form anymore; without the pass-through spread
	// this full-replace PUT would wipe them on the very first edit
	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.title).toBe('The Great Un-monolithing, renamed');
	expect(put.body.postcardTo).toBe('everyone');
	expect(put.body.postcardFrom).toBe('justin');
	expect(put.body.postmarked).toBe('2024 – ongoing');
	expect(put.body.stamp).toEqual({ shape: 'rect', motif: 'lighthouse', ink: '#f0d9a8', cents: '3¢' });
	expect(put.body.image).toBe('unmonolith-diagram.png');
});

test('editing a stampless light never invents a stamp ({} is invalid, omit entirely)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('The home lab, renamed');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p3$/);
	expect(put.body.title).toBe('The home lab, renamed');
	expect('stamp' in put.body).toBe(false);
	// full-replace: the complete document went over the wire
	expect(put.body.shortDesc).toBeTruthy();
	expect(put.body.tags.length).toBeGreaterThan(0);
});

test('the kind chips drive the mono code and hide the rhythm slider on fixed', async ({ page }) => {
	await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	// seeded flash, white, 8s
	await expect(overlay.getByText('Fl W 8s')).toBeVisible();
	await expect(overlay.getByText('every 8 seconds', { exact: true })).toBeVisible();

	await overlay.getByText('occulting', { exact: true }).click();
	await expect(overlay.getByText('Oc W 8s')).toBeVisible();

	await overlay.getByText('fixed · steady', { exact: true }).click();
	await expect(overlay.getByText('F W', { exact: true })).toBeVisible();
	await expect(overlay.locator('input[type="range"]')).toHaveCount(0);

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');
});

test('extinguishing a light adds a dark chip on the row, orthogonal to publish state', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('extinguished').fill('2025');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p2$/);
	expect(put.body.light.extinguished).toBe('2025');
	// publish state never moves through this PUT; the two stay orthogonal
	expect(put.body.status).toBe('published');
	await expect(row.getByText('● published')).toBeVisible();
	await expect(row.getByText('dark · 2025')).toBeVisible();
});

test('the gallery adds, reorders, and removes prints, and sends images alongside the untouched legacy image', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	// unmonolith-diagram.png already leads the gallery (seeded); add the second print
	await expect(overlay.getByText('unmonolith-diagram.png')).toBeVisible();
	await overlay.getByText('homelab-rack.jpg', { exact: true }).click();

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.images).toEqual(['unmonolith-diagram.png', 'homelab-rack.jpg']);
	// the legacy single print is untouched pass-through, not re-derived from the gallery
	expect(put.body.image).toBe('unmonolith-diagram.png');
});

test('the publish pill goes through the lifecycle endpoint, not PUT', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'The home lab' });
	await row.getByText('○ draft').click();
	await expect(toast(page)).toHaveText('● stamped and published');
	await expect(row.getByText('● published')).toBeVisible();
	expect(mock.find('POST', /^\/1\/project\/p3\/publish$/)).toHaveLength(1);
	expect(mock.find('PUT', /^\/1\/project\/p3$/)).toHaveLength(0);
});

test('the front window only fits three', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();

	// three seeded featured lights; a fourth is refused client-side
	const draftRow = page.locator('.content-row', { hasText: 'The home lab' });
	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('the window only fits three, take one down first');
	expect(mock.find('POST', /feature$/)).toHaveLength(0);

	// take one down from the window chips, then the spot is free
	await page.locator('.sway-chip', { hasText: 'Meo Wave Race' }).locator('.chip-x').click();
	await expect(toast(page)).toHaveText('☆ taken out of the window');
	expect(mock.find('POST', /^\/1\/project\/p2\/unfeature$/)).toHaveLength(1);

	await draftRow.getByText('☆ feature').click();
	await expect(toast(page)).toHaveText('★ set in the front window');
	expect(mock.find('POST', /^\/1\/project\/p3\/feature$/)).toHaveLength(1);
});

test('moving a light down the rack swaps orders via two reorder calls', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'projects').click();

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
	await nav(page, 'projects').click();
	const row = page.locator('.content-row', { hasText: 'Meo Wave Race' });

	await row.getByText('scuttle', { exact: true }).click();
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(0);
	await row.getByText('sure? scuttle.').click();
	await expect(toast(page)).toHaveText('🌊 scuttled. the sea keeps its secrets.');
	await expect(row).toHaveCount(0);
	expect(mock.find('DELETE', /^\/1\/project\/p2$/)).toHaveLength(1);
});
