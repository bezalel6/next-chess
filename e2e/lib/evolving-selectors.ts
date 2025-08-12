import { Page, Locator } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SelectorEntry {
  selector: string;
  context: string;
  success_rate: number;
  attempts: number;
  successes: number;
  timestamp?: string;
  last_success?: string;
  error?: string;
}

interface TestMemory {
  selectors: Record<string, {
    successful: SelectorEntry[];
    failed: SelectorEntry[];
  }>;
  flows: Record<string, any>;
  timing_adjustments: Record<string, any>;
  selector_patterns: any;
  error_recovery: any;
  metadata: any;
}

export class EvolvingSelector {
  private memory: TestMemory;
  private memoryPath: string;
  private page: Page;

  constructor(page: Page, memoryPath: string = './e2e/testing-memory.json') {
    this.page = page;
    this.memoryPath = memoryPath;
    this.memory = this.loadMemorySync();
  }

  private loadMemorySync(): TestMemory {
    try {
      const data = require(path.resolve(this.memoryPath));
      return data;
    } catch (error) {
      console.warn('Could not load testing memory, starting fresh');
      return this.createEmptyMemory();
    }
  }

  private createEmptyMemory(): TestMemory {
    return {
      selectors: {},
      flows: {},
      timing_adjustments: {},
      selector_patterns: {
        discovered_patterns: [],
        avoid_patterns: []
      },
      error_recovery: {
        common_errors: []
      },
      metadata: {
        version: '1.0.0',
        last_updated: new Date().toISOString(),
        total_test_runs: 0,
        overall_success_rate: 0,
        evolution_enabled: true
      }
    };
  }

  async findElement(action: string, context: string, timeout: number = 5000): Promise<Locator> {
    // 1. Try best known selector
    const bestSelector = this.getBestSelector(action, context);
    if (bestSelector) {
      try {
        const element = this.page.locator(bestSelector.selector);
        await element.waitFor({ state: 'visible', timeout: timeout / 2 });
        await this.recordSuccess(action, bestSelector.selector, context);
        return element;
      } catch (error) {
        await this.recordFailure(action, bestSelector.selector, context, error);
      }
    }

    // 2. Try fallback selectors
    const fallbacks = this.getFallbackSelectors(action, context);
    for (const fallback of fallbacks) {
      try {
        const element = this.page.locator(fallback.selector);
        await element.waitFor({ state: 'visible', timeout: timeout / 3 });
        await this.recordSuccess(action, fallback.selector, context);
        return element;
      } catch (error) {
        await this.recordFailure(action, fallback.selector, context, error);
      }
    }

    // 3. Discovery mode - try new patterns
    const discovered = await this.discoverSelector(action, context, timeout);
    if (discovered) {
      await this.addNewSelector(action, discovered.selector, context);
      return discovered.element;
    }

    throw new Error(`Could not find element for ${action} in ${context}`);
  }

  private getBestSelector(action: string, context: string): SelectorEntry | null {
    const actionSelectors = this.memory.selectors[action];
    if (!actionSelectors || !actionSelectors.successful.length) {
      return null;
    }

    // Filter by context and sort by success rate
    const contextSelectors = actionSelectors.successful
      .filter(s => s.context === context || s.context === 'any_page')
      .sort((a, b) => b.success_rate - a.success_rate);

    return contextSelectors[0] || null;
  }

  private getFallbackSelectors(action: string, context: string): SelectorEntry[] {
    const actionSelectors = this.memory.selectors[action];
    if (!actionSelectors || !actionSelectors.successful.length) {
      return [];
    }

    // Get all selectors except the best one, sorted by success rate
    const contextSelectors = actionSelectors.successful
      .filter(s => s.context === context || s.context === 'any_page')
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(1); // Skip the first (best) one

    return contextSelectors;
  }

  private async discoverSelector(
    action: string, 
    context: string, 
    timeout: number
  ): Promise<{ element: Locator; selector: string } | null> {
    const patterns = this.generateSelectorPatterns(action);
    
    for (const pattern of patterns) {
      try {
        const element = this.page.locator(pattern);
        await element.waitFor({ state: 'visible', timeout: timeout / patterns.length });
        return { element, selector: pattern };
      } catch {
        // Record failed pattern for future avoidance
        await this.recordFailedPattern(action, pattern, context);
      }
    }
    
    return null;
  }

  private generateSelectorPatterns(action: string): string[] {
    const patterns: string[] = [];
    
    // Generate patterns based on action name
    const actionWords = action.split('_');
    const variations = [
      action.replace(/_/g, '-'),  // snake_case to kebab-case
      actionWords.join(''),       // camelCase
      actionWords.join(' ')       // space separated
    ];
    
    // Data-testid patterns (most reliable)
    variations.forEach(v => {
      patterns.push(`[data-testid='${v}']`);
      patterns.push(`[data-testid*='${v}']`);
    });
    
    // Button text patterns
    if (action.includes('button') || action.includes('click')) {
      variations.forEach(v => {
        patterns.push(`button:has-text('${v}')`);
        patterns.push(`button:has-text('${this.toTitleCase(v)}')`);
      });
    }
    
    // ID patterns
    variations.forEach(v => {
      patterns.push(`#${v}`);
    });
    
    // Class patterns (least reliable)
    variations.forEach(v => {
      patterns.push(`.${v}`);
    });
    
    return patterns;
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, txt => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  }

  private async recordSuccess(action: string, selector: string, context: string): Promise<void> {
    if (!this.memory.selectors[action]) {
      this.memory.selectors[action] = { successful: [], failed: [] };
    }
    
    const existing = this.memory.selectors[action].successful
      .find(s => s.selector === selector && s.context === context);
    
    if (existing) {
      existing.attempts++;
      existing.successes++;
      existing.success_rate = existing.successes / existing.attempts;
      existing.last_success = new Date().toISOString();
    } else {
      this.memory.selectors[action].successful.push({
        selector,
        context,
        success_rate: 1.0,
        attempts: 1,
        successes: 1,
        timestamp: new Date().toISOString(),
        last_success: new Date().toISOString()
      });
    }
    
    await this.saveMemory();
  }

  private async recordFailure(
    action: string, 
    selector: string, 
    context: string, 
    error: any
  ): Promise<void> {
    if (!this.memory.selectors[action]) {
      this.memory.selectors[action] = { successful: [], failed: [] };
    }
    
    const existing = this.memory.selectors[action].successful
      .find(s => s.selector === selector && s.context === context);
    
    if (existing) {
      existing.attempts++;
      existing.success_rate = existing.successes / existing.attempts;
    }
    
    // Also add to failed list if not already there
    const failedEntry = this.memory.selectors[action].failed
      .find(s => s.selector === selector && s.context === context);
    
    if (!failedEntry) {
      this.memory.selectors[action].failed.push({
        selector,
        context,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString(),
        attempts: 1,
        successes: 0,
        success_rate: 0
      });
    }
    
    await this.saveMemory();
  }

  private async recordFailedPattern(
    action: string, 
    pattern: string, 
    context: string
  ): Promise<void> {
    // Add to avoid patterns if it fails multiple times
    const avoidPattern = this.memory.selector_patterns.avoid_patterns
      .find((p: any) => p.pattern === pattern);
    
    if (!avoidPattern) {
      this.memory.selector_patterns.avoid_patterns.push({
        pattern,
        reason: `Failed for ${action} in ${context}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async addNewSelector(
    action: string, 
    selector: string, 
    context: string
  ): Promise<void> {
    if (!this.memory.selectors[action]) {
      this.memory.selectors[action] = { successful: [], failed: [] };
    }
    
    this.memory.selectors[action].successful.push({
      selector,
      context,
      success_rate: 1.0,
      attempts: 1,
      successes: 1,
      timestamp: new Date().toISOString(),
      last_success: new Date().toISOString()
    });
    
    await this.saveMemory();
  }

  private async saveMemory(): Promise<void> {
    this.memory.metadata.last_updated = new Date().toISOString();
    this.memory.metadata.total_test_runs++;
    
    // Calculate overall success rate
    let totalAttempts = 0;
    let totalSuccesses = 0;
    
    Object.values(this.memory.selectors).forEach(actionSelectors => {
      actionSelectors.successful.forEach(s => {
        totalAttempts += s.attempts;
        totalSuccesses += s.successes;
      });
    });
    
    if (totalAttempts > 0) {
      this.memory.metadata.overall_success_rate = totalSuccesses / totalAttempts;
    }
    
    try {
      await fs.writeFile(
        this.memoryPath,
        JSON.stringify(this.memory, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save testing memory:', error);
    }
  }

  // Utility method to get optimal timing
  getOptimalTiming(timingKey: string): number {
    const timing = this.memory.timing_adjustments[timingKey];
    return timing?.optimal || 1000;
  }

  // Method to update timing based on results
  async updateTiming(timingKey: string, successful: boolean, duration: number): Promise<void> {
    if (!this.memory.timing_adjustments[timingKey]) {
      this.memory.timing_adjustments[timingKey] = {
        min: duration,
        optimal: duration,
        max: duration
      };
    }
    
    const timing = this.memory.timing_adjustments[timingKey];
    
    if (successful) {
      // If successful, we might be able to go faster
      timing.optimal = Math.round((timing.optimal + duration) / 2);
      timing.min = Math.min(timing.min, duration);
    } else {
      // If failed, we need more time
      timing.optimal = Math.round(timing.optimal * 1.2);
      timing.max = Math.max(timing.max, duration * 1.5);
    }
    
    await this.saveMemory();
  }
}