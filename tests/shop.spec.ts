import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

test('the catalog groups every carving by page: seven spots plus three catalog-only rows', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the carving shop').click();

	const catalog = page.locator('.carving-catalog');
	await expect(catalog.getByText('10 on the books · 0 fresh')).toBeVisible();
	await expect(catalog.locator('.carving-row')).toHaveCount(10);

	for (const name of ['The lighthouse', 'The little boat', 'Message in a bottle', 'Tower on the horizon', 'Paw print', 'The wave line', 'The boat wake']) {
		await expect(catalog.getByText(name, { exact: true })).toBeVisible();
	}
	for (const name of ['Postage lighthouse', 'The wreck', 'The harbor cat']) {
		await expect(catalog.getByText(name, { exact: true })).toBeVisible();
	}
});

test('a builtin carving shows locked source; copying it makes a fresh, editable block', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	// the lighthouse (bolted to lighthouse-logo) is the default bench selection
	await expect(page.getByText('on the bench · The lighthouse')).toBeVisible();
	await expect(page.getByLabel('carving source, locked')).toHaveAttribute('readonly', '');
	await expect(page.getByRole('button', { name: 'save the block' })).toHaveCount(0);

	await page.getByRole('button', { name: 'copy to a fresh block' }).click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await expect(page.getByText('on the bench · The lighthouse copy')).toBeVisible();
	await expect(page.getByLabel('carving source')).toBeVisible();

	const [post] = mock.find('POST', /^\/1\/carving\/carvings\/?$/);
	expect(post.body.name).toBe('The lighthouse copy');
	expect(post.body.svg).toContain('<svg');
});

test('a fresh block edits and saves through the standard save path, not the copy autosave', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await expect(toast(page)).toHaveText('⚒ a fresh block joins the catalog');
	await expect(page.getByText('on the bench · fresh carving no. 1')).toBeVisible();

	const source = page.getByLabel('carving source');
	await source.fill('<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"></circle></svg>');
	await expect(page.getByText('◍ unsaved')).toBeVisible();

	await page.getByRole('button', { name: 'save the block' }).click();
	await expect(toast(page)).toHaveText('⚒ carving saved to the bench');
	await expect(page.getByText('○ saved')).toBeVisible();

	// nextId starts at 100 and this is the test's first created document
	const [put] = mock.find('PUT', /^\/1\/carving\/carvings\/cv100$/);
	expect(put.body.svg).toContain('circle');
	expect(put.body.name).toBe('fresh carving no. 1');
});

test('bolting swaps a spot from its previous holder to the newly bolted carving', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the carving shop').click();

	await page.locator('.carving-row', { hasText: 'The little boat' }).click();
	await expect(page.getByText('on the bench · The little boat')).toBeVisible();

	await page.getByLabel('bolt it to').selectOption('lighthouse-logo');
	await page.getByRole('button', { name: '⚒ bolt it into place' }).click();

	await expect(toast(page)).toHaveText('⚒ "The little boat" bolted to the lighthouse. ships with the next hoist.');
	const [bolt] = mock.find('POST', /^\/1\/carving\/carvings\/cv-boat\/bolt$/);
	expect(bolt.body.spot).toBe('lighthouse-logo');

	// the lighthouse-logo row now opens the boat's carving, not the seed cat
	await page.locator('.carving-row', { hasText: 'The lighthouse' }).click();
	await expect(page.getByText('on the bench · The little boat')).toBeVisible();
});

test('a catalog-only row shows its note and offers no bench', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the carving shop').click();

	await page.locator('.carving-row').filter({ has: page.locator('.carving-row__name', { hasText: 'The wreck' }) }).click();
	await expect(page.getByText('salvage rights unresolved. edit it where it lies (404.dc.html).')).toBeVisible();
	await expect(page.locator('.carving-canvas')).toHaveCount(0);
	await expect(page.getByLabel('carving source')).toHaveCount(0);
	await expect(page.getByRole('button', { name: '⚒ bolt it into place' })).toHaveCount(0);
});

test('an empty block cannot bolt', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the carving shop').click();

	await page.getByRole('button', { name: '+ a fresh block' }).click();
	await page.getByLabel('carving source').fill('');
	await page.getByRole('button', { name: 'save the block' }).click();
	await expect(toast(page)).toHaveText('⚒ carving saved to the bench');

	await page.getByRole('button', { name: '⚒ bolt it into place' }).click();
	await expect(toast(page)).toHaveText('⚠ an empty block has nothing to bolt');
});

test("the figurehead entity keeps its frozen glyph in the keeper's log; the carving shop no longer edits it", async ({ page }) => {
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
