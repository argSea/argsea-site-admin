// The shell's phone collapse: below the drawer breakpoint the sidebar hides
// behind the top bar's hamburger and opens as an overlay drawer; desktop keeps
// the fixed rail untouched.
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { signIn, nav } from './office';

const sidebar = (page: Page) => page.locator('#office-sidebar');
const burger = (page: Page) => page.getByRole('button', { name: 'open the sidebar' });

test.describe('at phone width', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('the sidebar folds behind the hamburger and opens as a drawer', async ({ page }) => {
		await signIn(page);
		await expect(sidebar(page)).toBeHidden();
		await expect(burger(page)).toBeVisible();
		await expect(burger(page)).toHaveAttribute('aria-expanded', 'false');

		await burger(page).click();
		const drawer = sidebar(page);
		await expect(drawer).toBeVisible();
		await expect(page.getByRole('button', { name: 'close the sidebar' })).toHaveAttribute('aria-expanded', 'true');
		// the full sidebar rides along: nav, the lantern, the way ashore
		await expect(drawer.getByText('the lantern', { exact: true })).toBeVisible();
		await expect(drawer.getByText('← go ashore')).toBeVisible();
	});

	test('a nav tap switches screens and closes the drawer', async ({ page }) => {
		await signIn(page);
		await burger(page).click();
		await nav(page, 'postcards').click();
		await expect(page.getByText('Postcards from production')).toBeVisible();
		await expect(sidebar(page)).toBeHidden();
	});

	test('Escape closes the drawer and hands focus back to the toggle', async ({ page }) => {
		await signIn(page);
		await burger(page).click();
		await page.keyboard.press('Escape');
		await expect(sidebar(page)).toBeHidden();
		await expect(burger(page)).toBeFocused();
	});

	test('a backdrop tap closes the drawer', async ({ page }) => {
		await signIn(page);
		await burger(page).click();
		await page.locator('.office-drawer-backdrop').click({ position: { x: 380, y: 400 } });
		await expect(sidebar(page)).toBeHidden();
	});

	test('growing past the breakpoint drops the drawer and restores the rail', async ({ page }) => {
		await signIn(page);
		await burger(page).click();
		await page.setViewportSize({ width: 1280, height: 800 });
		await expect(page.locator('.office-drawer-backdrop')).toHaveCount(0);
		await expect(sidebar(page)).toBeVisible();
		await expect(burger(page)).toBeHidden();
	});
});

test('desktop keeps the fixed sidebar and no hamburger', async ({ page }) => {
	await signIn(page);
	await expect(sidebar(page)).toBeVisible();
	await expect(page.locator('.office-burger')).toBeHidden();
	await expect(sidebar(page)).toHaveCSS('position', 'sticky');
});
