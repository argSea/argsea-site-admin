import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn, nav, toast } from './office';

// The chart berth on the three chartables: coord decides chart presence, plate
// and cap are the dressing and follow the entry either way. The wire contract is
// caravan's 2026-07-28 chart-berths document; every assertion here reads a
// recorded body, since the berth's whole job is what rides the PUT.

const hobbyRow = (page: Page, name: string) =>
	page.locator('.content-row').filter({ has: page.getByText(name, { exact: true }) });

test('a berthed light opens with its bearings, plate and caption already in the fields', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'Meo Wave Race' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByLabel('charted position · latitude')).toHaveValue('58.1');
	await expect(overlay.getByLabel('· longitude')).toHaveValue('-7.3');
	await expect(overlay.getByLabel('plate · which photo-plate')).toHaveValue('3');
	await expect(overlay.getByLabel('caption · the line under the plate')).toHaveValue('A cat, mid-race.');
});

test('charting a light writes the pair, the plate and the trimmed caption', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('charted position · latitude').fill('58.31');
	await overlay.getByLabel('· longitude').fill('-7.11');
	await overlay.getByLabel('plate · which photo-plate').fill('4');
	await overlay.getByLabel('caption · the line under the plate').fill('  Forty services, one queue.  ');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.coord).toEqual({ lat: 58.31, lon: -7.11 });
	expect(put.body.plate).toBe(4);
	expect(put.body.cap).toBe('Forty services, one queue.');
});

test('an uncharted light with no caption sends null and empty, never a fabricated berth', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();

	// p1 predates the berth: the fields open blank and saving fills nothing in
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();
	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByLabel('charted position · latitude')).toHaveValue('');
	await expect(overlay.getByLabel('plate · which photo-plate')).toHaveValue('');
	await expect(overlay.getByLabel('caption · the line under the plate')).toHaveValue('');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.coord).toBeNull();
	// a blank plate is the default plate, not an unset marker
	expect(put.body.plate).toBe(0);
	expect(put.body.cap).toBe('');
});

test('a half-charted berth bounces before the wire', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('charted position · latitude').fill('58.31');
	mock.calls.length = 0;
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('⚠ a berth needs both bearings, or neither');
	expect(mock.find('PUT', /^\/1\/project\//)).toHaveLength(0);
	await expect(overlay).toBeVisible();
});

test('a bearing typed off the Helm snaps back onto it on blur, and the copy names the chart it serves', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText(
		'// the Helm runs 57.80 to 58.70 north, 8.30 to 6.10 west · a bearing off the edge snaps back onto it',
	)).toBeVisible();

	const lat = overlay.getByLabel('charted position · latitude');
	await lat.fill('61.4');
	await overlay.getByLabel('· longitude').click();
	await expect(lat).toHaveValue('58.7');
});

test('the berth band is the Helm extent, not the ships-log window: a berth above the hobby ceiling stays put', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	// 58.65N / 8.10W sits outside the ships-log's 57.82-58.56 / 7.94-6.59 window;
	// the migrated berths that live up there must not be hauled back on save
	const overlay = page.locator('.overlay-card');
	const lat = overlay.getByLabel('charted position · latitude');
	const lon = overlay.getByLabel('· longitude');
	await lat.fill('58.65');
	await lon.fill('-8.10');
	await lat.click();
	await expect(lat).toHaveValue('58.65');
	await expect(lon).toHaveValue('-8.10');

	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('🕯 the light was filed');
	expect(mock.find('PUT', /^\/1\/project\/p1$/)[0].body.coord).toEqual({ lat: 58.65, lon: -8.10 });
});

test('the hobby editor keeps its own band and its own helper line', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the wandering chart').click();
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText(
		'// the chart runs 57.82 to 58.56 north, 7.94 to 6.59 west · a bearing off the edge snaps back onto it',
	)).toBeVisible();

	const lat = overlay.getByLabel('charted position · latitude');
	await lat.fill('58.65');
	await overlay.getByLabel('· longitude').click();
	await expect(lat).toHaveValue('58.56');
});

test('the plate helper line is written once, wherever the dressing appears', async ({ page }) => {
	await signIn(page);
	const line = '// plate 0 is the plate it gets if you say nothing · the caption keeps whether it\'s charted or not';

	await nav(page, 'the wandering chart').click();
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();
	await expect(page.locator('.overlay-card').getByText(line)).toHaveCount(1);

	await page.locator('.overlay-card').getByText('never mind').click();
	await nav(page, 'the light list').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();
	await expect(page.locator('.overlay-card').getByText(line)).toHaveCount(1);
});

test('a plate that is not a plain index falls back or truncates, never rides the wire mangled', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();
	const overlay = page.locator('.overlay-card');
	const plate = () => overlay.getByLabel('plate · which photo-plate');

	// a fraction truncates toward zero rather than rounding up to the next plate
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();
	await plate().fill('2.9');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');
	expect(mock.find('PUT', /^\/1\/hobby\/h3$/)[0].body.plate).toBe(2);

	// parseInt would have read the exponent's mantissa and sent plate 1
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();
	await plate().fill('1e3');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	expect(mock.find('PUT', /^\/1\/hobby\/h3$/)[1].body.plate).toBe(1000);
});

test('the note desk berths a note the same way, and uncharting it clears the coord', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The queue is the product' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByLabel('plate · which photo-plate')).toHaveValue('1');
	await expect(overlay.getByLabel('caption · the line under the plate')).toHaveValue('The queue, at rest.');
	await overlay.getByLabel('charted position · latitude').fill('');
	await overlay.getByLabel('· longitude').fill('');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✎ filed at the writing desk');

	// off the chart, still dressed: the plate and the caption outlive the coord
	const [put] = mock.find('PUT', /^\/1\/note\/n1$/);
	expect(put.body.coord).toBeNull();
	expect(put.body.plate).toBe(1);
	expect(put.body.cap).toBe('The queue, at rest.');
});

test('a hobby carries the dressing without touching its own bearings', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('plate · which photo-plate').fill('2');
	await overlay.getByLabel('caption · the line under the plate').fill('Both hands, one night.');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');

	const [put] = mock.find('PUT', /^\/1\/hobby\/h3$/);
	expect(put.body.plate).toBe(2);
	expect(put.body.cap).toBe('Both hands, one night.');
	expect(put.body.coord).toEqual({ lat: 58.42, lon: -7.12 });
});

test('a negative plate clamps up to the default plate rather than riding the wire', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the wandering chart').click();
	await hobbyRow(page, 'Piano').getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('plate · which photo-plate').fill('-3');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✳ position updated');

	expect(mock.find('PUT', /^\/1\/hobby\/h3$/)[0].body.plate).toBe(0);
});
