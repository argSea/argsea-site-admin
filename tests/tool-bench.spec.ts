import { test, expect } from '@playwright/test';
import { signIn, nav, toast } from './office';

test('a new drawer fills, autosaves into the copy singleton, and the cap holds at four', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the tool bench').click();

	// the three seeded drawers ride in from the copy singleton
	await expect(page.locator('.bench-drawer')).toHaveCount(3);
	await expect(page.locator('.bench-drawer', { hasText: 'languages' })).toContainText('5 tools');

	await page.getByRole('button', { name: '+ a new drawer' }).click();
	const label = page.getByTitle("the drawer's label. write on the brass plate.");
	await expect(label).toHaveValue('new drawer');
	await expect(page.getByText('an empty drawer. it happens to the best benches.')).toBeVisible();
	await label.fill('ceremonies');

	await page.getByPlaceholder('a tool that earned the shelf...').fill('grep');
	await page.getByRole('button', { name: '+ into the drawer' }).click();
	await expect(page.locator('.bench-chip', { hasText: 'grep' })).toBeVisible();
	// adding a tool stays toastless
	await expect(toast(page)).toHaveCount(0);

	// four drawers is plenty: the add button gives way to the full note
	await expect(page.getByRole('button', { name: '+ a new drawer' })).toHaveCount(0);
	await expect(page.getByText('// the bench is full. four drawers is plenty.')).toBeVisible();

	// it all rode the debounced copy autosave, full replace
	await expect.poll(() => {
		const puts = mock.find('PUT', /^\/1\/copy\/?$/);
		const last = puts[puts.length - 1];
		return last ? JSON.stringify(last.body.stores?.[3] ?? null) : '';
	}).toBe(JSON.stringify({ label: 'ceremonies', tools: ['grep'] }));
	const puts = mock.find('PUT', /^\/1\/copy\/?$/);
	const last = puts[puts.length - 1].body;
	expect(last.stores).toHaveLength(4);
	expect(last.quipHello).toBe('The boats run on schedule. Ish.');
});

test('scrapping a drawer takes two clicks, then it all goes overboard', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the tool bench').click();

	await page.locator('.bench-drawer', { hasText: 'data & queues' }).click();
	await page.getByText('scrap this drawer').click();
	// armed, not fired: the drawer still stands
	await expect(page.getByText('sure? it all goes overboard')).toBeVisible();
	await expect(page.locator('.bench-drawer')).toHaveCount(3);

	await page.getByText('sure? it all goes overboard').click();
	await expect(page.locator('.bench-drawer', { hasText: 'data & queues' })).toHaveCount(0);
	// the selection falls back to the first drawer
	await expect(page.locator('.bench-drawer--on')).toContainText('languages');
	await expect(toast(page)).toHaveText('🪓 the drawer went overboard.');

	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.stores.map((d: { label: string }) => d.label)).toEqual(['languages', 'infrastructure']);
});

test('a tool comes off the bench from its chip', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the tool bench').click();

	await page.locator('.bench-chip', { hasText: 'php' }).getByTitle('off the bench').click();
	await expect(page.locator('.bench-chip', { hasText: 'php' })).toHaveCount(0);
	await expect(page.locator('.bench-drawer', { hasText: 'languages' })).toContainText('4 tools');
	// removing a tool stays toastless
	await expect(toast(page)).toHaveCount(0);

	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.stores[0].tools).toEqual(['java', 'python', 'node.js', 'go']);
});
