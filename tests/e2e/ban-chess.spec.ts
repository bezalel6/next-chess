import { test, expect } from '@playwright/test';

test.describe('Ban Chess Basic Tests', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/Ban Chess/);
  });

  test('shows sign in form', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('text=Sign in to Play', { timeout: 10000 });
    
    const signInText = await page.textContent('h5');
    expect(signInText).toContain('Sign in to Play');
  });

  test('can navigate to game page', async ({ page }) => {
    await page.goto('http://localhost:3000/game/test-game-id');
    
    // Should either show loading or game content
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });
});