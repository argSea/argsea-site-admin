import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('switching a stamp to a postmark drops the cents (cents ride on rect only)', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('postmark', { exact: true }).click();
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✉ postcard filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.stamp.shape).toBe('circle');
	expect('cents' in put.body.stamp).toBe(false);
	expect(put.body.stamp.motif).toBe('lighthouse');
	expect(put.body.stamp.ink).toBe('#f0d9a8');
});

test('flipping back to a stamp restores a denomination', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('postmark', { exact: true }).click();
	await overlay.getByText('stamp', { exact: true }).click();
	await overlay.getByRole('button', { name: 'save changes' }).click();

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.stamp.shape).toBe('rect');
	expect(put.body.stamp.cents).toBe('3¢');
});

test('a words stamp caps at 40 characters and refuses to sail empty', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('words', { exact: true }).click();
	const wordsInput = overlay.getByPlaceholder('AIR MAIL');
	await expect(wordsInput).toBeVisible();

	// the input clips at the API's 40-char cap
	await wordsInput.fill('');
	await wordsInput.pressSequentially('THIS CAPTION IS LONGER THAN FORTY CHARACTERS LONG');
	await expect(wordsInput).toHaveValue('THIS CAPTION IS LONGER THAN FORTY CHARAC');

	// and an empty caption blocks the save — text is required on the text motif
	await wordsInput.fill('   ');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('⚠ a words stamp needs its words');
	expect(mock.find('PUT', /^\/1\/project\/p1$/)).toHaveLength(0);

	// give it words and it files fine
	await wordsInput.fill('PAR AVION');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✉ postcard filed');
	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(put.body.stamp.motif).toBe('text');
	expect(put.body.stamp.text).toBe('PAR AVION');
});

test('surprise me only ever deals from the API deck', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('⚄ surprise me').click();
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText('✉ postcard filed');

	const [put] = mock.find('PUT', /^\/1\/project\/p1$/);
	const stamp = put.body.stamp;
	expect(['rect', 'circle']).toContain(stamp.shape);
	expect(['lighthouse', 'boat', 'sun', 'wave', 'moon', 'anchor', 'text']).toContain(stamp.motif);
	expect(['#f0d9a8', '#93a0e8']).toContain(stamp.ink);
	if (stamp.motif === 'text') {
		expect(stamp.text.trim().length).toBeGreaterThan(0);
		expect(stamp.text.length).toBeLessThanOrEqual(40);
	}
	if (stamp.shape !== 'rect') {
		expect('cents' in stamp).toBe(false);
	}
});
