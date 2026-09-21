// The papers: a shelf of stored resume cuts, exactly one of them out there.
// The notes are the keeper's private working copy, so this screen is the only
// place they show.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn, nav, toast } from './office';

const A_PDF = { name: 'architect.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 not really') };

const pickPdf = (page: Page) => page.locator('input[type=file]').setInputFiles(A_PDF);

test('the shelf lists every cut with its notes, and flags the one that is out there', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the papers').click();

	await expect(page.locator('.content-row')).toHaveCount(2);
	await expect(page.getByText('2 cuts on the shelf · "Senior software engineer" is out there')).toBeVisible();

	const live = page.locator('.content-row', { hasText: 'Senior software engineer' });
	await expect(live).toHaveClass(/content-row--gold/);
	await expect(live).toContainText('◍ the live cut');
	await expect(live).toContainText('the long one. leans on the un-monolithing.');

	// a cut with no notes says so rather than showing an empty gap
	await expect(page.locator('.content-row', { hasText: 'Systems architect' })).toContainText('no notes on this cut.');
});

test('a fresh cut is filed with its title and notes, and lands on the shelf unpublished', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the papers').click();

	await page.getByPlaceholder('systems architect, long form').fill('Staff engineer, short');
	await page.getByPlaceholder('what this cut leans on, and who it went to...').fill('two pages. sent to the harbor board.');
	await pickPdf(page);
	await expect(page.getByRole('button', { name: '↻ architect.pdf' })).toBeVisible();

	await page.getByRole('button', { name: 'file it on the shelf' }).click();
	await expect(toast(page)).toHaveText('📄 filed. the cut is on the shelf.');

	// the record and its pdf are stored in one multipart call
	const [filed] = mock.find('POST', /^\/1\/resume\/$/);
	expect(filed.post).toContain('name="title"');
	expect(filed.post).toContain('Staff engineer, short');
	expect(filed.post).toContain('two pages. sent to the harbor board.');
	expect(filed.post).toContain('architect.pdf');

	const fresh = page.locator('.content-row', { hasText: 'Staff engineer, short' });
	await expect(fresh).toContainText('two pages. sent to the harbor board.');
	await expect(fresh.getByRole('button', { name: 'send this one out' })).toBeVisible();
	await expect(page.getByText('3 cuts on the shelf · "Senior software engineer" is out there')).toBeVisible();

	// the form empties itself once the shelf holds the paper
	await expect(page.getByPlaceholder('systems architect, long form')).toHaveValue('');
	await expect(page.getByRole('button', { name: '+ pick the pdf' })).toBeVisible();
});

test('filing without a pdf, or without a title, never reaches the wire', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the papers').click();

	await page.getByPlaceholder('systems architect, long form').fill('Untitled ambitions');
	await page.getByRole('button', { name: 'file it on the shelf' }).click();
	await expect(toast(page)).toHaveText('pick a pdf first; the shelf holds papers, not titles');

	await page.getByPlaceholder('systems architect, long form').fill('   ');
	await pickPdf(page);
	await page.getByRole('button', { name: 'file it on the shelf' }).click();
	await expect(toast(page)).toHaveText('give the cut a title, or you will never tell them apart');

	expect(mock.find('POST', /^\/1\/resume\/$/)).toHaveLength(0);
});

test('publishing a cut clears whichever one held the shelf', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the papers').click();

	await page.locator('.content-row', { hasText: 'Systems architect' })
		.getByRole('button', { name: 'send this one out' }).click();

	await expect(toast(page)).toHaveText('⚑ the papers are out: "Systems architect" is the live cut now');
	expect(mock.find('POST', /^\/1\/resume\/r2\/publish$/)).toHaveLength(1);

	// the swap is one call: the office mirrors it rather than re-reading the list
	await expect(page.locator('.content-row', { hasText: 'Systems architect' })).toContainText('◍ the live cut');
	await expect(page.locator('.content-row', { hasText: 'Senior software engineer' }))
		.toContainText('send this one out');
	await expect(page.getByText('2 cuts on the shelf · "Systems architect" is out there')).toBeVisible();
	expect(mock.find('GET', /^\/1\/resume\/$/)).toHaveLength(1);
});

test('a stored cut opens by its own pdf, for comparing one against another', async ({ page }) => {
	await signIn(page);
	await nav(page, 'the papers').click();

	const read = page.locator('.content-row', { hasText: 'Systems architect' }).getByRole('link', { name: 'read it' });
	// the pdf is served off the api host's web path, like a darkroom print
	await expect(read).toHaveAttribute('href', /^https?:\/\/[^/]+:8181\/media\/files\/d4e5f6\.pdf$/);
	await expect(read).toHaveAttribute('target', '_blank');
});

test('a filing failure reaches the keeper in the API\'s own words', async ({ page }) => {
	const mock = new MockApi();
	mock.resumeFilingError = 'open /var/www/media/files: permission denied';
	await signIn(page, mock);
	await nav(page, 'the papers').click();

	await page.getByPlaceholder('systems architect, long form').fill('Systems architect, revised');
	await pickPdf(page);
	await page.getByRole('button', { name: 'file it on the shelf' }).click();

	await expect(toast(page)).toHaveText('⚠ open /var/www/media/files: permission denied');
	// the cut never made the shelf, and the form keeps what was typed
	await expect(page.locator('.content-row')).toHaveCount(2);
	await expect(page.getByPlaceholder('systems architect, long form')).toHaveValue('Systems architect, revised');
});
