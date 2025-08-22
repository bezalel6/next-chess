import { supabase } from '@/utils/supabase';

export interface BrowserInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  viewport: string;
}

export interface BugReportData {
  currentPath: string;
  query: Record<string, any>;
  [key: string]: any; // Allow additional properties for JSON compatibility
}

export interface BugReport {
  id?: string;
  user_id?: string;
  user_email?: string;
  category: 'logic' | 'visual' | 'performance' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  browser_info?: BrowserInfo;
  page_url?: string;
  game_id?: string;
  screenshot_url?: string;
  additional_data?: BugReportData;
}

// Input sanitization helper
function sanitizeText(text: string, maxLength: number = 5000): string {
  if (!text) return '';
  
  // Remove any potential script tags or HTML
  const cleaned = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  
  // Limit length
  return cleaned.substring(0, maxLength);
}

export class BugReportService {
  static getBrowserInfo(): BrowserInfo {
    // Check if we're in a browser environment
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return {
        userAgent: 'SSR',
        platform: 'SSR',
        language: 'en',
        screenResolution: '0x0',
        viewport: '0x0'
      };
    }
    
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`
    };
  }

  static async submitBugReport(
    report: BugReport, 
    screenshotUrl?: string
  ): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
      const { data: session } = await supabase.auth.getSession();
      const user_id = session?.session?.user?.id || null;
      const user_email = report.user_email || session?.session?.user?.email || null;

      const browser_info = this.getBrowserInfo();
      const page_url = window.location.href;

      // Sanitize all text inputs
      const sanitizedReport = {
        ...report,
        // Cast enum-like fields to strings to fit Supabase Json typing
        category: report.category,
        severity: report.severity,
        title: sanitizeText(report.title, 200),
        description: sanitizeText(report.description, 5000),
        steps_to_reproduce: report.steps_to_reproduce ? sanitizeText(report.steps_to_reproduce, 2000) : null,
        expected_behavior: report.expected_behavior ? sanitizeText(report.expected_behavior, 1000) : null,
        actual_behavior: report.actual_behavior ? sanitizeText(report.actual_behavior, 1000) : null,
        user_email: user_email ? sanitizeText(user_email, 100) : null,
        user_id,
        browser_info: browser_info as unknown as any,
        page_url: sanitizeText(page_url, 500),
        screenshot_url: screenshotUrl ? sanitizeText(screenshotUrl, 500) : null,
        additional_data: report.additional_data as unknown as any,
        created_at: new Date().toISOString()
      } as any;

      const { data, error } = await supabase
        .from('bug_reports')
        .insert([sanitizedReport])
        .select()
        .single();

      if (error) {
        console.error('Error submitting bug report:', error);
        return { success: false, error: 'Failed to submit bug report. Please try again.' };
      }

      return { success: true, id: data.id };
    } catch (error) {
      console.error('Error in submitBugReport:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  }

  static async getUserBugReports(userId: string): Promise<BugReport[]> {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50); // Limit results to prevent excessive data transfer

      if (error) {
        console.error('Error fetching bug reports:', error);
        return [];
      }

      return (data || []) as unknown as BugReport[];
    } catch (error) {
      console.error('Error in getUserBugReports:', error);
      return [];
    }
  }
}