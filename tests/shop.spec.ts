import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

test('the shelf lists both poses, seeds published and marked', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the carving shop').click();

	const perched = page.locator('.card', { hasText: 'Perched' });
	const lying = page.locator('.card', { hasText: 'Lying' });
	await expect(perched.getByText('2 on the shelf · one on the bow')).toBeVisible();
	await expect(lying.getByText('1 on the shelf · one on the bow')).toBeVisible();

	// the published seed leads its pose with both pills on
	const seedRow = perched.locator('.shelf-row', { hasText: 'v1' });
	await expect(seedRow.getByText('published')).toBeVisible();
	await expect(seedRow.getByText('seed', { exact: true })).toBeVisible();
	// seeds cannot be relabeled; the PUT would 409
	await expect(seedRow.getByRole('button', { name: 'rename' })).toHaveCount(0);

	const draftRow = perched.locator('.shelf-row', { hasText: 'second fitting' });
	await expect(draftRow.getByText('published')).toHaveCount(0);
	await expect(draftRow.getByRole('button', { name: 'publish' })).toBeVisible();
});

test('rename rides a full PUT that only changes the label', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	// the row's title becomes the input, so the row no longer matches by text;
	// while renaming, the shelf holds exactly one design-label input
	await page.locator('.shelf-row', { hasText: 'second fitting' }).getByRole('button', { name: 'rename' }).click();
	await page.getByLabel('design label').fill('third fitting');
	await page.getByLabel('design label').press('Enter');

	await expect(toast(page)).toHaveText('⚒ relabeled and hung back up');
	await expect(page.locator('.shelf-row', { hasText: 'third fitting' })).toBeVisible();

	const [put] = mock.find('PUT', /^\/1\/figurehead\/designs\/fh3$/);
	expect(put.body.label).toBe('third fitting');
	expect(put.body.pose).toBe('perched');
	expect(put.body.shapes).toHaveLength(2);
});

test('delete honors the seed and published guards, scraps a draft', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	// a seed's delete is barred outright
	const seedRow = page.locator('.card', { hasText: 'Perched' }).locator('.shelf-row', { hasText: 'v1' });
	await expect(seedRow.getByTitle('a seed is carved, it stays')).toBeDisabled();

	// the draft goes, on the second (armed) click
	const draftRow = page.locator('.shelf-row', { hasText: 'second fitting' });
	await draftRow.getByTitle('scrap this design').click();
	await draftRow.getByTitle('scrap this design').click();
	await expect(toast(page)).toHaveText('🪓 scrapped. sawdust and all.');
	await expect(page.locator('.shelf-row', { hasText: 'second fitting' })).toHaveCount(0);
	expect(mock.find('DELETE', /^\/1\/figurehead\/designs\/fh3$/)).toHaveLength(1);
});

test('publish arms a confirm naming the swap, then swaps the pill', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	const perched = page.locator('.card', { hasText: 'Perched' });
	const draftRow = perched.locator('.shelf-row', { hasText: 'second fitting' });
	await draftRow.getByRole('button', { name: 'publish' }).click();
	const armed = draftRow.getByRole('button', { name: 'replaces v1 as the perched cat on next hoist, sure?' });
	await expect(armed).toBeVisible();
	await armed.click();

	await expect(toast(page)).toHaveText('♆ second fitting leads the perched pose on next hoist');
	expect(mock.find('POST', /^\/1\/figurehead\/designs\/fh3\/publish$/)).toHaveLength(1);

	// exactly one published per pose; the pill moved off the seed
	await expect(draftRow.getByText('published')).toBeVisible();
	const seedRow = perched.locator('.shelf-row', { hasText: 'v1' });
	await expect(seedRow.getByText('published')).toHaveCount(0);
	// and the freshly published draft can no longer be scrapped
	await expect(draftRow.getByTitle('lower it before scrapping it, publish another first')).toBeDisabled();
});

test("figurehead lines wear their glyph in the keeper's log", async ({ page }) => {
	const mock = new MockApi();
	mock.activity.unshift({
		id: 'a0', timestamp: '2026-07-05T10:00:00Z',
		message: 'figurehead "second fitting" saved', entityType: 'figurehead', entityId: 'fh3',
	});
	await signIn(page, mock);

	const row = page.locator('span[title="figurehead"]');
	await expect(row.first()).toHaveText('♆');
	await expect(page.getByText('figurehead "second fitting" saved')).toBeVisible();
});
