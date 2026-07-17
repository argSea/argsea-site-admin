import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav } from './office';

// a print tile: the filename span's parent div, so a hook badge can be
// checked against the print it actually hangs from
const tileOf = (page: Page, filename: string) => page.getByText(filename, { exact: true }).locator('xpath=..');

test('the watch desk loads the record and the preview reads it back', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the watch desk').click();

	// the form reads the stubbed record
	await expect(page.getByLabel('the letter')).toHaveValue(/ArcXP migration/);
	await expect(page.getByLabel('out of the rotation')).toHaveValue('Conference talks, one more framework, and the piano.');

	// the preview: dateline, rotation line, and the bearings strip
	await expect(page.locator('.watch-preview')).toContainText('kept 10 jul');
	await expect(page.getByText('Out of the rotation on purpose: Conference talks, one more framework, and the piano.')).toBeVisible();
	await expect(page.locator('.watch-strip')).toContainText('The queue is the product');
	await expect(page.getByText('// the dateline stamps itself on save · last kept 10 jul 2026')).toBeVisible();

	// picking a source refills the dependent target select and the shown name
	await page.getByLabel('the source').first().selectOption('light');
	await expect(page.getByLabel('the target').first()).toHaveValue('p1');
	await expect(page.getByTitle('what the front door shows. picking a source refills it; edit freely after.').first())
		.toHaveValue('The Great Un-monolithing');
	await expect(page.locator('.watch-strip')).toContainText('The Great Un-monolithing');

	// picking a print hoists the postcard into the preview
	await page.getByText('homelab-rack.jpg').click();
	await expect(page.getByText('from the season · jul 2026')).toBeVisible();
});

test('a bearing whose target sailed shows the adrift warning', async ({ page }) => {
	const mock = new MockApi();
	mock.watch.bearings = [{ verb: 'logging', kind: 'note', targetId: 'n404', name: 'A note that sank' }];
	await signIn(page, mock);
	await nav(page, 'the watch desk').click();

	await expect(page.getByText('adrift: "A note that sank" no longer matches anything at its source. the name stays; the link went with the tide.')).toBeVisible();
});

test('keep the watch sends the whole record, never keptAt, three bearings at most', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the watch desk').click();

	// three bearings ride in, so the add button has given way
	await expect(page.getByRole('button', { name: '+ a bearing' })).toHaveCount(0);
	await page.getByTitle('strike the bearing').first().click();
	await page.getByRole('button', { name: '+ a bearing' }).click();
	await expect(page.getByRole('button', { name: '+ a bearing' })).toHaveCount(0);

	await page.getByLabel('the letter').fill('A fresh letter.\n\nStill true.');
	await expect(page.locator('.watch-preview')).toContainText('Still true.');
	await page.getByText('homelab-rack.jpg').click();

	await page.getByRole('button', { name: 'keep the watch' }).click();
	await expect(page.getByText('kept · the front door reads this now')).toBeVisible();

	await expect.poll(() => mock.find('PUT', /^\/1\/watch\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/watch\/?$/);
	expect(put.body.letter).toBe('A fresh letter.\n\nStill true.');
	// the filename rides the wire, never the mongo id: the media route serves
	// filenames, and a stored id 404s on the front door
	expect(put.body.postcardMediaId).toBe('homelab-rack.jpg');
	// keptAt is the server's to stamp; it never rides the wire
	expect('keptAt' in put.body).toBe(false);
	expect(put.body.bearings).toHaveLength(3);
	expect(put.body.bearings[2]).toEqual({ verb: 'minding', kind: 'none', targetId: '', name: 'a new thread' });
	// the whole record went along; the write is a full replace
	expect(put.body.quips).toHaveLength(2);
});

test('clear the watch keeps an empty record, resetting both hooks', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the watch desk').click();

	// hang a print on each hook before clearing
	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await page.getByText('meo-wave-title.png', { exact: true }).click();

	await page.getByText('clear the watch').click();
	await expect(page.getByText('The watch stands empty.')).toBeVisible();
	await expect(page.getByText('the homepage section folds away until the next one is kept')).toBeVisible();

	await expect.poll(() => mock.find('PUT', /^\/1\/watch\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/watch\/?$/);
	expect(put.body.letter).toBe('');
	expect(put.body.rotation).toBe('');
	expect(put.body.bearings).toEqual([]);
	expect(put.body.postcardMediaId).toBe('');
	expect(put.body.postcard2MediaId).toBe('');
	expect('keptAt' in put.body).toBe(false);
	// the cat's remarks stay aboard: they belong to the watch, not the letter
	expect(put.body.quips).toHaveLength(2);
});

test('picking two prints hangs one on each hook, both riding the wire', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the watch desk').click();

	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await expect(tileOf(page, 'unmonolith-diagram.png').getByText('❀ first hook')).toBeVisible();

	await page.getByText('homelab-rack.jpg', { exact: true }).click();
	await expect(tileOf(page, 'homelab-rack.jpg').getByText('❀ second hook')).toBeVisible();
	// the first hook's print holds regardless
	await expect(tileOf(page, 'unmonolith-diagram.png').getByText('❀ first hook')).toBeVisible();

	// both polaroids ride the preview
	await expect(page.getByText('from the season · jul 2026')).toBeVisible();
	await expect(page.getByText('also from the season · the keeper liked it')).toBeVisible();

	await page.getByRole('button', { name: 'keep the watch' }).click();
	await expect.poll(() => mock.find('PUT', /^\/1\/watch\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/watch\/?$/);
	expect(put.body.postcardMediaId).toBe('unmonolith-diagram.png');
	expect(put.body.postcard2MediaId).toBe('homelab-rack.jpg');
});

test('a third pick with both hooks full swaps the second hook, the first stays put', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the watch desk').click();

	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await page.getByText('homelab-rack.jpg', { exact: true }).click();
	await page.getByText('meo-wave-title.png', { exact: true }).click();

	await expect(tileOf(page, 'unmonolith-diagram.png').getByText('❀ first hook')).toBeVisible();
	await expect(tileOf(page, 'meo-wave-title.png').getByText('❀ second hook')).toBeVisible();
	// homelab-rack.jpg fell off the rack entirely
	await expect(tileOf(page, 'homelab-rack.jpg').getByText(/❀/)).toHaveCount(0);
	await expect(page.getByText('❀ second hook')).toHaveCount(1);
});

test('taking the first hook down promotes the second hook to take its place', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the watch desk').click();

	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await page.getByText('homelab-rack.jpg', { exact: true }).click();

	// tap the hung first print again to take it down
	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await expect(tileOf(page, 'unmonolith-diagram.png').getByText(/❀/)).toHaveCount(0);
	await expect(tileOf(page, 'homelab-rack.jpg').getByText('❀ first hook')).toBeVisible();
	await expect(page.getByText('❀ second hook')).toHaveCount(0);
});

test('taking the second hook down leaves the first exactly as it was', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the watch desk').click();

	await page.getByText('unmonolith-diagram.png', { exact: true }).click();
	await page.getByText('homelab-rack.jpg', { exact: true }).click();

	// tap the hung second print again to take it down
	await page.getByText('homelab-rack.jpg', { exact: true }).click();
	await expect(tileOf(page, 'homelab-rack.jpg').getByText(/❀/)).toHaveCount(0);
	await expect(tileOf(page, 'unmonolith-diagram.png').getByText('❀ first hook')).toBeVisible();
});
