import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('the <p> adapter round-trips a note body', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	await page.getByRole('button', { name: '+ new note' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('Round trip');
	await overlay.getByLabel('the note itself').fill('para one\n\npara two & a half');
	await overlay.getByRole('button', { name: 'file it' }).click();
	await expect(toast(page)).toHaveText('✎ filed at the writing desk');

	// save: blank-line split, <p> wrap, entities escaped
	const [create] = mock.find('POST', /^\/1\/note\/$/);
	expect(create.body.body).toBe('<p>para one</p>\n<p>para two &amp; a half</p>');
	expect(create.body.status).toBe('draft');

	// load: back to blank-line-joined plain text
	await page.locator('.note-row', { hasText: 'Round trip' }).getByText('edit', { exact: true }).click();
	await expect(overlay.getByLabel('the note itself')).toHaveValue('para one\n\npara two & a half');
});

test('a soft break inside a paragraph survives as <br>', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	await page.getByRole('button', { name: '+ new note' }).click();

	const overlay = page.locator('.overlay-card');
	await overlay.getByLabel('title').fill('Soft breaks');
	await overlay.getByLabel('the note itself').fill('line one\nline two\n\npara two');
	await overlay.getByRole('button', { name: 'file it' }).click();
	await expect(toast(page)).toHaveText('✎ filed at the writing desk');

	const [create] = mock.find('POST', /^\/1\/note\/$/);
	expect(create.body.body).toBe('<p>line one<br>line two</p>\n<p>para two</p>');

	await page.locator('.note-row', { hasText: 'Soft breaks' }).getByText('edit', { exact: true }).click();
	await expect(overlay.getByLabel('the note itself')).toHaveValue('line one\nline two\n\npara two');
});

test('unknown tags in a stored body are dropped gracefully on load', async ({ page }) => {
	await signIn(page);
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The home lab ate my weekend' }).getByText('edit', { exact: true }).click();

	// seeded body: <h2>…</h2><p>kept <em>text</em> here</p>
	await expect(page.locator('.overlay-card').getByLabel('the note itself'))
		.toHaveValue('an heading the sanitizer let through\n\nkept text here');
});

test('the note publish pill uses the lifecycle endpoint', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	const row = page.locator('.note-row', { hasText: 'The home lab ate my weekend' });
	await row.getByText('○ draft').click();
	await expect(toast(page)).toHaveText('● posted. no promises broken yet.');
	expect(mock.find('POST', /^\/1\/note\/n2\/publish$/)).toHaveLength(1);
});

test('peek renders the note as text — paragraphs, print, and the sign-off', async ({ page }) => {
	await signIn(page);
	await nav(page, 'writing desk').click();
	await page.locator('.note-row', { hasText: 'The queue is the product' }).getByText('peek', { exact: true }).click();

	const peek = page.locator('.overlay-card');
	await expect(peek.getByText('draft — only you can see this')).toHaveCount(0);
	await expect(peek.getByText('published — this is live')).toBeVisible();
	await expect(peek.getByText('A decade of publishing systems.')).toBeVisible();
	await expect(peek.getByText('The queue was the product all along.')).toBeVisible();
	await expect(peek.getByText('— j')).toBeVisible();
	// nothing was injected as markup — the body renders in one text node
	expect(await peek.locator('h2').count()).toBe(0);
	await page.keyboard.press('Escape');
	await expect(peek).toHaveCount(0);
});

test('burning a note takes two clicks', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'writing desk').click();
	const row = page.locator('.note-row', { hasText: 'The home lab ate my weekend' });
	await row.getByText('burn', { exact: true }).click();
	await row.getByText('sure? burn it.').click();
	await expect(toast(page)).toHaveText('🕯 burned. it never happened.');
	expect(mock.find('DELETE', /^\/1\/note\/n2$/)).toHaveLength(1);
	await expect(row).toHaveCount(0);
});
