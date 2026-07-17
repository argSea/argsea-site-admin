// The shell's phone collapse: below the phone line the fixed rail hides and a
// sticky topbar stands in (logo, deploy verb, way ashore, scrollable nav chips).
// Rollback and the lantern's status panel stay desktop-only. Desktop keeps the
// fixed rail untouched.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn } from './office';

const sidebar = (page: Page) => page.locator('#office-sidebar');
const topbar = (page: Page) => page.locator('.office-topbar');

// the banked grouping: dash · watch through bench · marginalia through the
// darkroom · signal flags through the cove, a rule above each group's first row
const navOrder = [
	/the watch room/,
	/the watch desk/,
	/the light list/,
	/the wandering chart/,
	/writing desk/,
	/the tool bench/,
	/marginalia/,
	/the carving shop/,
	/the darkroom/,
	/signal flags/,
	/the keeper/,
	/smuggler's cove/,
];

test.describe('at phone width', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the rail hides and the sticky topbar stands in, off the same nav data', async ({ page }) => {
		await signIn(page);
		await expect(sidebar(page)).toBeHidden();
		await expect(topbar(page)).toBeVisible();

		// the whole nav rides along as scrollable chips in the banked group
		// order, with an upright rule between groups, plus the deploy verb and
		// the way ashore
		await expect(page.locator('.topbar-chip')).toHaveCount(12);
		await expect(page.locator('.topbar-chip')).toHaveText(navOrder);
		await expect(topbar(page).locator('.topbar-rule')).toHaveCount(3);
		await expect(topbar(page).locator('.topbar-deploy')).toBeVisible();
		await expect(topbar(page).locator('.topbar-ashore')).toBeVisible();

		// the lantern's status panel and rollback stay desktop-only: the phone
		// gets the button, not the gauge
		await expect(topbar(page).getByText('the lantern', { exact: true })).toHaveCount(0);
		await expect(topbar(page).getByText(/re-hoist the previous lantern/)).toHaveCount(0);
	});

	test('a nav chip switches screens and the topbar stays put', async ({ page }) => {
		await signIn(page);
		await page.locator('.topbar-chip', { hasText: 'the light list' }).click();
		await expect(page.locator('.page-title')).toHaveText('The light list');
		await expect(topbar(page)).toBeVisible();
	});

	test('the way ashore logs out from the topbar', async ({ page }) => {
		await signIn(page);
		await topbar(page).locator('.topbar-ashore').click();
		await expect(page.getByPlaceholder('who goes there?')).toBeVisible();
	});

	test('growing past the breakpoint drops the topbar and restores the rail', async ({ page }) => {
		await signIn(page);
		await expect(topbar(page)).toBeVisible();
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(topbar(page)).toBeHidden();
		await expect(sidebar(page)).toBeVisible();
	});
});

test('desktop keeps the fixed sidebar and hides the topbar', async ({ page }) => {
	await signIn(page);
	await expect(sidebar(page)).toBeVisible();
	await expect(page.locator('.office-topbar')).toBeHidden();
	await expect(sidebar(page)).toHaveCSS('position', 'sticky');

	// the rail forms up in the same groups, a thin rule above each one
	await expect(sidebar(page).locator('.nav-item')).toHaveText(navOrder);
	await expect(sidebar(page).locator('.nav-rule')).toHaveCount(3);
});

test('the brand line reads the keeper record\'s name, rail and topbar alike', async ({ page }) => {
	await signIn(page);
	await expect(sidebar(page)).toContainText('Justin');

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(topbar(page)).toContainText('Justin');
});
