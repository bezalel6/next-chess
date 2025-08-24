import type { Tables, TablesInsert, TablesUpdate } from './database'

// Bug Report type aliases for better developer experience
export type BugReport = Tables<'bug_reports'>
export type BugReportInsert = TablesInsert<'bug_reports'>
export type BugReportUpdate = TablesUpdate<'bug_reports'>

// Enums for bug report fields
export const BugReportCategory = {
  LOGIC: 'logic',
  VISUAL: 'visual',
  PERFORMANCE: 'performance',
  OTHER: 'other'
} as const

export const BugReportSeverity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const

export const BugReportStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  DUPLICATE: 'duplicate'
} as const

export type BugReportCategoryType = typeof BugReportCategory[keyof typeof BugReportCategory]
export type BugReportSeverityType = typeof BugReportSeverity[keyof typeof BugReportSeverity]
export type BugReportStatusType = typeof BugReportStatus[keyof typeof BugReportStatus]

// Browser info structure
export interface BrowserInfo {
  userAgent: string
  platform: string
  language: string
  screenResolution: string
  viewport: string
  [key: string]: unknown
}

// Additional data structure for extensibility
export interface AdditionalData {
  gameState?: unknown
  errorLogs?: string[]
  customFields?: Record<string, unknown>
  [key: string]: unknown
}