import { test, expect } from '@playwright/test';
import { signIn, nav } from './office';

test('the keeper autosaves the complete user doc, never role, never password', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'the keeper').click();

	const name = page.getByLabel('name · what the harbor calls you');
	await expect(name).toHaveValue('Justin');
	await name.fill('Meo');

	// "saved as you type" is a debounced PUT
	await expect.poll(() => mock.find('PUT', /^\/1\/user\/u1$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/user\/u1$/);

	// the complete doc rode along (full-replace), profile merged over it
	expect(put.body.name).toBe('Meo');
	expect(put.body.userName).toBe('meo');
	expect(put.body.pronouns).toBe('he/him');
	expect(put.body.signoff).toBe('– j');
	// and the fields that must never leave the office
	expect('role' in put.body).toBe(false);
	expect('password' in put.body).toBe(false);

	// the greeting reads from the papers
	await expect(page.getByText('quick errands')).toHaveCount(0);
	await expect(page.locator('text=/, Meo/').first()).toBeVisible();
});

test('signal flags autosave the complete singleton', async ({ page }) => {
	const mock = await signIn(page);
	await nav(page, 'signal flags').click();

	const hello = page.getByLabel('hello', { exact: true });
	await expect(hello).toHaveValue('The boats run on schedule. Ish.');
	await hello.fill('The boats run late. Charmingly.');

	await expect.poll(() => mock.find('PUT', /^\/1\/copy\/?$/).length).toBe(1);
	const [put] = mock.find('PUT', /^\/1\/copy\/?$/);
	expect(put.body.quipHello).toBe('The boats run late. Charmingly.');
	// the rest of the doc went with it; PUT is full-replace
	expect(put.body.heroHeadline).toBe('I help keep the lights on behind the news.');
	expect(put.body.dict).toBe('1. the Argo, but for one.');
	expect(put.body.quip404).toBeTruthy();
});
