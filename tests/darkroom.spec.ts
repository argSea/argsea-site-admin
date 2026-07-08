import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

test('developing a print uploads multipart and hangs the tile', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the darkroom').click();

	await page.locator('input[type="file"]').setInputFiles({ name: 'new-print.png', mimeType: 'image/png', buffer: PNG });
	await expect(toast(page)).toHaveText('🖼 developed. hang it to dry.');

	const [upload] = mock.find('POST', /^\/1\/media\/$/);
	expect(upload.headers['content-type']).toContain('multipart/form-data');
	expect(upload.post).toContain('name="file"');
	expect(upload.post).toContain('filename="new-print.png"');
	await expect(page.getByText('new-print.png')).toBeVisible();
});

test('the darkroom only develops images', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the darkroom').click();
	await page.locator('input[type="file"]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('nope') });
	await expect(toast(page)).toHaveText('the darkroom only develops images');
	expect(mock.find('POST', /^\/1\/media\/$/)).toHaveLength(0);
});

test('tearing off a used print warns, detaches via a PUT with image: null, then deletes', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the darkroom').click();

	// homelab-rack.jpg is glued to project p3 — notes carry a doodle now, not a print
	const tile = page.locator('.tilt', { hasText: 'homelab-rack.jpg' });
	await expect(tile.getByText('on 1 card')).toBeVisible();

	await tile.locator('.print-del').click();
	await expect(toast(page)).toHaveText('⚠ still glued to 1 card — click again to tear it off');
	expect(mock.find('DELETE', /^\/1\/media\//)).toHaveLength(0);

	await tile.locator('.print-del').click();
	await expect(toast(page)).toHaveText('print torn off its cards and left in the sun');

	// the detach PUT carries the COMPLETE document (full-replace!) with image null
	const projectPut = mock.find('PUT', /^\/1\/project\/p3$/)[0];
	expect(projectPut.body.image).toBeNull();
	expect(projectPut.body.title).toBe('The home lab');
	expect(mock.find('PUT', /^\/1\/note\/n2$/)).toHaveLength(0);
	expect(mock.find('DELETE', /^\/1\/media\/m2$/)).toHaveLength(1);
	await expect(tile).toHaveCount(0);
});

test('an unused print goes quietly', async ({ page }) => {
	const mock = await signIn(page);
	// detach p1 from its print first so m1 is unused
	await nav(page, 'postcards').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await row.getByText('edit', { exact: true }).click();
	await page.locator('.overlay-card').getByText('no print').click();
	await page.locator('.overlay-card').getByRole('button', { name: 'save changes' }).click();
	await expect(page.locator('.overlay-card')).toHaveCount(0);
	expect(mock.find('PUT', /^\/1\/project\/p1$/)[0].body.image).toBeNull();

	await nav(page, 'the darkroom').click();
	const tile = page.locator('.tilt', { hasText: 'unmonolith-diagram.png' });
	await expect(tile.getByText(/on \d+ card/)).toHaveCount(0);
	await tile.locator('.print-del').click();
	await tile.locator('.print-del').click();
	await expect(toast(page)).toHaveText('print left out in the sun');
	expect(mock.find('DELETE', /^\/1\/media\/m1$/)).toHaveLength(1);
});
