import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('rolling back loads the earlier printing into the form', async ({ page }) => {
	await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await expect(overlay.getByText('earlier printings · last 5 kept')).toBeVisible();
	await overlay.getByText('“The Great Un-monolithing (early draft)” — before the polish')
		.locator('..').locator('..').getByText('roll back ↺').click();

	await expect(toast(page)).toHaveText('↺ earlier printing loaded — file it to keep it');
	await expect(overlay.getByLabel('title')).toHaveValue('The Great Un-monolithing (early draft)');
});

test('filing an untouched restored draft goes through the restore endpoint — status travels', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	const row = page.locator('.content-row', { hasText: 'The Great Un-monolithing' });
	await expect(row.getByText('● published')).toBeVisible();
	await row.getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('roll back ↺').nth(1).click();
	await overlay.getByRole('button', { name: 'save changes' }).click();

	// the copy-forward, not a plain PUT — a PUT would preserve lifecycle and
	// the restored draft status would never land
	await expect(toast(page)).toHaveText("↺ earlier printing filed — it's now a draft ○");
	expect(mock.find('POST', /^\/1\/project\/p1\/revisions\/r1\/restore$/)).toHaveLength(1);
	expect(mock.find('PUT', /^\/1\/project\/p1$/)).toHaveLength(0);

	await expect(page.locator('.content-row', { hasText: '(early draft)' }).getByText('○ draft')).toBeVisible();
});

test('editing after a roll back files the restore, then PUTs on top', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'postcards').click();
	await page.locator('.content-row', { hasText: 'The Great Un-monolithing' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('roll back ↺').nth(1).click();
	await overlay.getByLabel('title').fill('The Great Un-monolithing (early draft, polished)');
	await overlay.getByRole('button', { name: 'save changes' }).click();

	await expect(toast(page)).toHaveText("↺ earlier printing filed — it's now a draft ○");
	expect(mock.find('POST', /^\/1\/project\/p1\/revisions\/r1\/restore$/)).toHaveLength(1);
	const puts = mock.find('PUT', /^\/1\/project\/p1$/);
	expect(puts).toHaveLength(1);
	expect(puts[0].body.title).toBe('The Great Un-monolithing (early draft, polished)');
});

test('notes have printings too', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The queue is the product' }).getByText('edit', { exact: true }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByText('roll back ↺').click();
	await expect(overlay.getByLabel('title')).toHaveValue('The queue is the product (v1)');
	await overlay.getByRole('button', { name: 'save changes' }).click();
	await expect(toast(page)).toHaveText("↺ earlier printing filed — it's now a draft ○");
	expect(mock.find('POST', /^\/1\/note\/n1\/revisions\/r3\/restore$/)).toHaveLength(1);
});
