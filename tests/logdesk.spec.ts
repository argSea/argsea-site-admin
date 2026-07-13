import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

// walk to the light list and raise its third pill, the logs shelf
async function openShelf(page: import('@playwright/test').Page) {
	await nav(page, 'the light list').click();
	await page.getByText('the logs', { exact: true }).click();
}

test('the logs shelf lists the full logs with their state and count', async ({ page }) => {
	await signIn(page);
	await openShelf(page);

	await expect(page.getByText('3 logs on the shelf · 1 lit')).toBeVisible();

	const lit = page.locator('.log-row', { hasText: 'The Great Un-monolithing' });
	await expect(lit.getByText('lit', { exact: true })).toBeVisible();
	await expect(lit.getByText('unpublish', { exact: true })).toBeVisible();

	const draft = page.locator('.log-row', { hasText: 'Un-monolithing (rewrite)' });
	await expect(draft.getByText('draft', { exact: true })).toBeVisible();
	await expect(draft.getByText('publish', { exact: true })).toBeVisible();
});

test('the new-log flow seeds a desk from the chosen light', async ({ page }) => {
	const mock = await signIn(page);
	await openShelf(page);

	await page.getByRole('button', { name: '+ new log' }).click();
	await expect(page.getByText('Which light is this a log for?')).toBeVisible();
	await page.getByText('This website', { exact: true }).click();

	await expect(page.getByText('Start from a template')).toBeVisible();
	await page.getByText('a blank desk', { exact: true }).click();
	await page.getByRole('button', { name: 'open the desk →' }).click();

	await expect(page.getByText('← the logs shelf')).toBeVisible();
	await expect(toast(page)).toHaveText('a new log, seeded from the light. saved as a draft.');

	// the create POST carried the seeded header title, keyed to the light
	const [create] = mock.find('POST', /^\/1\/caselog\/$/);
	expect(create.body.projectId).toBe('p4');
	expect(create.body.title).toBe('This website');
	expect(create.body.blocks[0]).toMatchObject({ kind: 'title', text: 'This website' });
	expect(create.body.status).toBe('draft');
});

test('editing, adding, and reordering blocks each autosaves a full-doc PUT', async ({ page }) => {
	const mock = await signIn(page);
	await openShelf(page);
	// click the title itself: two rows carry the light's name (cl2's line names
	// its light too), but only cl1's title reads it exactly
	await page.getByText('The Great Un-monolithing', { exact: true }).click();
	await expect(page.getByText('saved · draft rev 7')).toBeVisible();

	// edit the title block; the debounced autosave PUTs the whole doc and the
	// echo ticks the rev on the save line
	await page.getByPlaceholder("the light's title").fill('The Great Un-monolithing, redux');
	await expect(page.getByText('saved · draft rev 8')).toBeVisible();
	const afterEdit = mock.find('PUT', /^\/1\/caselog\/cl1$/).at(-1)!;
	expect(afterEdit.body.title).toBe('The Great Un-monolithing, redux');
	expect(afterEdit.body.blocks[0]).toMatchObject({ kind: 'title', text: 'The Great Un-monolithing, redux' });

	// add a quote from the palette, then move it up one slot
	await page.getByText('＋ block', { exact: true }).click();
	await expect(page.getByText('insert a block')).toBeVisible();
	await page.getByText('quote', { exact: true }).click();
	await expect(page.locator('[data-block-kind="quote"]')).toHaveCount(1);
	await page.locator('[data-block-kind="quote"]').getByTitle('move up').click();

	await expect(page.getByText('saved · draft rev 9')).toBeVisible();
	const afterBlocks = mock.find('PUT', /^\/1\/caselog\/cl1$/).at(-1)!;
	const kinds = afterBlocks.body.blocks.map((b: { kind: string }) => b.kind);
	expect(kinds).toContain('quote');
	// blocks persist as JSON, never a serialized dialect string
	expect(typeof afterBlocks.body.blocks).toBe('object');
});

test('a selected block saves as a set and re-inserts from the palette', async ({ page }) => {
	const mock = await signIn(page);
	await openShelf(page);
	await page.locator('.log-row', { hasText: 'The home lab' }).getByText('open the desk', { exact: true }).click();
	await expect(page.getByText('← the logs shelf')).toBeVisible();

	// select the title block and save the selection as a named set
	await page.locator('[data-block-kind="title"]').getByText('○', { exact: true }).click();
	await page.getByText('save set (1)').click();
	await page.getByPlaceholder('e.g. header').fill('just the title');
	await page.getByRole('button', { name: 'save the set' }).click();
	await expect(toast(page)).toHaveText('saved "just the title" as a block set.');

	const [set] = mock.find('POST', /^\/1\/blockset\/$/);
	expect(set.body.name).toBe('just the title');
	expect(set.body.blocks[0]).toMatchObject({ kind: 'title' });

	// re-insert it from the palette's block sets section
	await page.getByText('＋ block', { exact: true }).click();
	await expect(page.getByText('insert a block')).toBeVisible();
	await page.locator('[data-block-set]', { hasText: 'just the title' }).click();
	await expect(page.locator('[data-block-kind="title"]')).toHaveCount(2);
});

test('publishing a draft swaps the lit log after the confirm', async ({ page }) => {
	const mock = await signIn(page);
	await openShelf(page);

	await page.locator('.log-row', { hasText: 'Un-monolithing (rewrite)' }).getByText('publish', { exact: true }).click();
	await expect(page.getByText('Publish "Un-monolithing (rewrite)"?')).toBeVisible();
	await expect(page.getByText(/is the lit log for this light/)).toBeVisible();
	await page.getByRole('button', { name: 'yes, light it' }).click();

	await expect(toast(page)).toHaveText('● lit. it goes public with the next hoist.');
	expect(mock.find('POST', /^\/1\/caselog\/cl2\/publish$/)).toHaveLength(1);

	// the swap is atomic: the rewrite is lit now, the old lit log dropped to draft
	await expect(page.locator('.log-row', { hasText: 'Un-monolithing (rewrite)' }).getByText('lit', { exact: true })).toBeVisible();
	await expect(page.locator('.log-row', { hasText: 'The Great Un-monolithing' }).getByText('draft', { exact: true })).toBeVisible();
});
