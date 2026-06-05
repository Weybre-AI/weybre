import { test, expect } from '@playwright/test';

test.describe('Weybre AI Enterprise Golden Path', () => {
  
  test('should complete the core research flow', async ({ page }) => {
    // 1. Authentication
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'enterprise-test@weybre.ai');
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button:has-text("Sign In")');
    
    // 2. Dashboard Access
    await expect(page).toHaveURL('/app');
    await expect(page.locator('h1')).toContainText('Dashboard');

    // 3. Legal Research (Initiative 1)
    await page.click('a:has-text("Research")');
    await page.fill('textarea', 'What are the latest Supreme Court guidelines on Section 498A IPC?');
    await page.click('button:has-text("Search")');
    
    // Verify GraphRAG citations are present
    await expect(page.locator('.citation-card')).toBeVisible();
    await expect(page.locator('text=Supreme Court of India')).toBeVisible();

    // 4. Contract Drafting (Initiative 2)
    await page.click('a:has-text("Drafting")');
    await page.click('button:has-text("New Draft")');
    await page.click('text=Non-Disclosure Agreement');
    await page.fill('textarea[placeholder*="Ask AI"]', 'Draft a mutual NDA for a software merger.');
    await page.click('button:has-text("Generate")');
    
    // Verify iterative history
    await expect(page.locator('.chat-message')).toHaveCount(2);
    await expect(page.locator('textarea.font-serif')).not.toBeEmpty();

    // 5. Settings & API Keys (Initiative 5)
    await page.click('a:has-text("Settings")');
    await page.fill('input[placeholder*="Internal Research Tool"]', 'E2E Test Key');
    await page.click('button:has-text("Create")');
    await expect(page.locator('code')).toBeVisible();
  });

});
