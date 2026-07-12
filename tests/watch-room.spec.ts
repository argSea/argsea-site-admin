import { test, expect } from '@playwright/test';
import { MockApi } from './mock-api';
import { signIn } from './office';

test('the watch room reads real sightings: tiles, bars, caption, resolved tops, ports', async ({ page }) => {
	const mock = await signIn(page);

	// ships sighted = uniques, locale-formatted; the mom joke stays
	await expect(page.getByText('1,204')).toBeVisible();
	await expect(page.getByText('visitors this week. one was mom.')).toBeVisible();

	// the uptime tile is gone, replaced by a real notes stat off the harbor store
	await expect(page.getByText('lighthouse uptime')).toHaveCount(0);
	await expect(page.getByText('notes posted')).toBeVisible();
	await expect(page.getByText('1 / 2')).toBeVisible();
	await expect(page.getByText('posted / at the desk')).toBeVisible();

	// caption reads sails (the week total), not uniques
	await expect(page.getByText('3,218 ships sighted · busiest: thursday')).toBeVisible();

	// the tops resolve their subject ids to titles from the store
	await expect(page.getByText('"Meo Wave Race", 214 flips')).toBeVisible();
	await expect(page.getByText('"The queue is the product", 178 reads')).toBeVisible();
	await expect(page.getByText('"Piano", 96 visits')).toBeVisible();
	await expect(page.getByText('search 44% · direct 31% · fediverse 25%')).toBeVisible();

	// the boat's proverb count reads through, locale-formatted
	await expect(page.getByText('428 proverbs off the passing boat')).toBeVisible();

	// seven bars, heights normalized to the busiest day (thursday, 640 sails)
	await expect(page.locator('div[title$="ships"]')).toHaveCount(7);
	await expect(page.getByTitle('thursday · 640 ships')).toHaveAttribute('style', /height: 100%/);
	await expect(page.getByTitle('saturday · 300 ships')).toHaveAttribute('style', /height: 47%/);

	// the read asked for a week, once
	const reads = mock.find('GET', /^\/1\/sighting\/traffic$/);
	expect(reads.length).toBeGreaterThan(0);
	expect(reads[0].search).toBe('?days=7');
});

test('null tops and zero bottles render placeholder lines, not blanks', async ({ page }) => {
	const mock = new MockApi();
	mock.traffic = { ...mock.traffic, topPostcard: null, topNote: null, topHobby: null, bottles: 0 };
	await signIn(page, mock);

	await expect(page.getByText('nothing flipped yet.')).toBeVisible();
	await expect(page.getByText('nothing opened yet.')).toBeVisible();
	await expect(page.getByText('nobody stopped by yet.')).toBeVisible();
	await expect(page.getByText('the boat kept its corks in.')).toBeVisible();
	// the rest of the card still stands
	await expect(page.getByText('3,218 ships sighted · busiest: thursday')).toBeVisible();
	await expect(page.getByText('search 44% · direct 31% · fediverse 25%')).toBeVisible();
});

test('an older traffic shape (no top plot or bottles) degrades to the quiet lines', async ({ page }) => {
	const mock = new MockApi();
	delete mock.traffic.topHobby;
	delete mock.traffic.bottles;
	await signIn(page, mock);

	await expect(page.getByText('nobody stopped by yet.')).toBeVisible();
	await expect(page.getByText('the boat kept its corks in.')).toBeVisible();
	// the fields the old shape does carry still read true
	await expect(page.getByText('"Meo Wave Race", 214 flips')).toBeVisible();
});

test('a missing sightings route (deploy skew) fails soft to quiet placeholders', async ({ page }) => {
	const mock = new MockApi();
	mock.trafficMounted = false;
	await signIn(page, mock);

	// the traffic-fed tile and card go quiet
	await expect(page.getByText('the sea is quiet. no count yet.')).toBeVisible();
	await expect(page.getByText('the sea is quiet. no sightings on the glass yet.')).toBeVisible();
	// no fake caption is invented
	await expect(page.getByText(/ships sighted · busiest/)).toHaveCount(0);
	// and the rest of the board still reads true
	await expect(page.getByText('quick errands')).toBeVisible();
	await expect(page.getByText('1 / 2')).toBeVisible();
	await expect(page.getByText('3 / 4')).toBeVisible();
});

test('a traffic error fails soft the same way', async ({ page }) => {
	const mock = new MockApi();
	mock.trafficBroken = true;
	await signIn(page, mock);

	await expect(page.getByText('the sea is quiet. no sightings on the glass yet.')).toBeVisible();
	await expect(page.getByText('quick errands')).toBeVisible();
});

test('the harbor conditions card is gone and the lower grid reflows', async ({ page }) => {
	await signIn(page);

	await expect(page.getByText('harbor conditions')).toHaveCount(0);
	await expect(page.getByText('newsletter cron')).toHaveCount(0);
	// what remains: the keeper's log, harbor traffic, quick errands
	await expect(page.getByText("the keeper's log")).toBeVisible();
	await expect(page.getByText('harbor traffic · this week')).toBeVisible();
	await expect(page.getByText('quick errands')).toBeVisible();
});
