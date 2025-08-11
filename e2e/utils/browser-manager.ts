import puppeteer, { Browser, Page } from 'puppeteer';
import { TEST_CONFIG } from './test-config';

export class BrowserManager {
  private browsers: Browser[] = [];
  private pages: Map<string, Page> = new Map();

  async createBrowser(): Promise<Browser> {
    const browser = await puppeteer.launch(TEST_CONFIG.puppeteer);
    this.browsers.push(browser);
    return browser;
  }

  async createPage(browser: Browser, name: string): Promise<Page> {
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(TEST_CONFIG.timeouts.navigation);
    await page.setDefaultTimeout(TEST_CONFIG.timeouts.action);
    
    // Set viewport
    await page.setViewport(TEST_CONFIG.puppeteer.defaultViewport!);
    
    // Intercept console logs for debugging
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') {
        console.error(`[${name}] Console error:`, msg.text());
      } else if (process.env.DEBUG) {
        console.log(`[${name}] Console ${type}:`, msg.text());
      }
    });
    
    // Log page errors
    page.on('pageerror', error => {
      console.error(`[${name}] Page error:`, error.message);
    });
    
    this.pages.set(name, page);
    return page;
  }

  async cleanup(): Promise<void> {
    // Close all pages
    for (const [name, page] of this.pages) {
      try {
        await page.close();
        console.log(`Closed page: ${name}`);
      } catch (error) {
        console.error(`Error closing page ${name}:`, error);
      }
    }
    
    // Close all browsers
    for (const browser of this.browsers) {
      try {
        await browser.close();
      } catch (error) {
        console.error('Error closing browser:', error);
      }
    }
    
    this.pages.clear();
    this.browsers = [];
  }

  getPage(name: string): Page | undefined {
    return this.pages.get(name);
  }
}