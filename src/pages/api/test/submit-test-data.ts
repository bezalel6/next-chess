import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow in test mode
  if (process.env.NEXT_PUBLIC_USE_TEST_AUTH !== 'true') {
    return res.status(403).json({ error: 'Test mode not enabled' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const testData = req.body;
    const memoryPath = path.join(process.cwd(), 'e2e', 'testing-memory.json');
    
    // Read existing memory
    let memory: any = {};
    try {
      const content = await fs.readFile(memoryPath, 'utf-8');
      memory = JSON.parse(content);
    } catch {
      // File doesn't exist or is invalid, start fresh
      memory = {
        selectors: {},
        flows: {},
        timing_adjustments: {},
        selector_patterns: {},
        error_recovery: {},
        metadata: {
          version: '1.0.0',
          last_updated: new Date().toISOString(),
          total_test_runs: 0,
          overall_success_rate: 0,
          evolution_enabled: true
        }
      };
    }

    // Update memory based on test data type
    switch (testData.type) {
      case 'selector_success': {
        const { name, selector, context } = testData.data;
        if (!memory.selectors[name]) {
          memory.selectors[name] = { successful: [], failed: [] };
        }
        
        // Find or create selector entry
        let selectorEntry = memory.selectors[name].successful.find(
          (s: any) => s.selector === selector && s.context === context
        );
        
        if (!selectorEntry) {
          selectorEntry = {
            selector,
            context,
            success_rate: 1.0,
            attempts: 1,
            successes: 1,
            last_success: testData.timestamp,
            timestamp: testData.timestamp
          };
          memory.selectors[name].successful.push(selectorEntry);
        } else {
          selectorEntry.attempts++;
          selectorEntry.successes++;
          selectorEntry.success_rate = selectorEntry.successes / selectorEntry.attempts;
          selectorEntry.last_success = testData.timestamp;
        }
        
        // Sort by success rate
        memory.selectors[name].successful.sort((a: any, b: any) => b.success_rate - a.success_rate);
        break;
      }
      
      case 'selector_failure': {
        const { name, selector, error } = testData.data;
        if (!memory.selectors[name]) {
          memory.selectors[name] = { successful: [], failed: [] };
        }
        
        // Update success rate if selector exists in successful list
        let selectorEntry = memory.selectors[name].successful.find(
          (s: any) => s.selector === selector
        );
        
        if (selectorEntry) {
          selectorEntry.attempts++;
          selectorEntry.success_rate = selectorEntry.successes / selectorEntry.attempts;
        }
        
        // Add to failed list
        memory.selectors[name].failed.push({
          selector,
          error,
          timestamp: testData.timestamp
        });
        
        // Keep only last 10 failures
        memory.selectors[name].failed = memory.selectors[name].failed.slice(-10);
        break;
      }
      
      case 'timing_adjustment': {
        const { operation, duration_ms } = testData.data;
        if (!memory.timing_adjustments[operation]) {
          memory.timing_adjustments[operation] = {
            min: duration_ms,
            optimal: duration_ms,
            max: duration_ms,
            samples: []
          };
        }
        
        const timing = memory.timing_adjustments[operation];
        timing.samples.push(duration_ms);
        
        // Keep only last 20 samples
        timing.samples = timing.samples.slice(-20);
        
        // Recalculate min, optimal, max
        timing.min = Math.min(...timing.samples);
        timing.max = Math.max(...timing.samples);
        timing.optimal = Math.round(
          timing.samples.reduce((a: number, b: number) => a + b, 0) / timing.samples.length
        );
        break;
      }
      
      case 'flow_complete': {
        const { flowName, success, duration_ms } = testData.data;
        const flowPath = flowName.split('.');
        let flowSection = memory.flows;
        
        // Navigate to the correct flow section
        for (let i = 0; i < flowPath.length - 1; i++) {
          if (!flowSection[flowPath[i]]) {
            flowSection[flowPath[i]] = {};
          }
          flowSection = flowSection[flowPath[i]];
        }
        
        const finalKey = flowPath[flowPath.length - 1];
        if (!flowSection[finalKey]) {
          flowSection[finalKey] = { successful_sequences: [], failed_sequences: [] };
        }
        
        // Update flow statistics
        const flow = flowSection[finalKey];
        if (success) {
          let sequence = flow.successful_sequences[0];
          if (!sequence) {
            sequence = {
              steps: [],
              success_rate: 1.0,
              avg_duration_ms: duration_ms,
              total_runs: 1,
              successful_runs: 1
            };
            flow.successful_sequences.push(sequence);
          } else {
            sequence.total_runs++;
            sequence.successful_runs++;
            sequence.success_rate = sequence.successful_runs / sequence.total_runs;
            sequence.avg_duration_ms = Math.round(
              (sequence.avg_duration_ms * (sequence.total_runs - 1) + duration_ms) / sequence.total_runs
            );
          }
        } else {
          flow.failed_sequences.push({
            timestamp: testData.timestamp,
            duration_ms
          });
          // Keep only last 5 failures
          flow.failed_sequences = flow.failed_sequences.slice(-5);
        }
        break;
      }
      
      case 'error_recovery': {
        const { errorType, strategy, success } = testData.data;
        if (!memory.error_recovery.common_errors) {
          memory.error_recovery.common_errors = [];
        }
        
        let errorEntry = memory.error_recovery.common_errors.find(
          (e: any) => e.error === errorType
        );
        
        if (!errorEntry) {
          errorEntry = {
            error: errorType,
            recovery_strategies: []
          };
          memory.error_recovery.common_errors.push(errorEntry);
        }
        
        // Add or update strategy
        if (!errorEntry.recovery_strategies.includes(strategy) && success) {
          errorEntry.recovery_strategies.push(strategy);
        }
        break;
      }
    }

    // Update metadata
    memory.metadata.last_updated = new Date().toISOString();
    memory.metadata.total_test_runs++;
    
    // Save updated memory
    await fs.writeFile(memoryPath, JSON.stringify(memory, null, 2));
    
    res.status(200).json({ success: true, data: testData });
  } catch (error) {
    console.error('Failed to submit test data:', error);
    res.status(500).json({ error: 'Failed to submit test data' });
  }
}