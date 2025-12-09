import type { ExportFormat } from '~types/soql'

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function escapeMarkdown(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

function flattenRecord(
  record: Record<string, unknown>,
  prefix = ''
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(record)) {
    if (key === 'attributes') continue

    const fullKey = prefix ? `${prefix}.${key}` : key

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = flattenRecord(value as Record<string, unknown>, fullKey)
      Object.assign(result, nested)
    } else {
      result[fullKey] = value
    }
  }

  return result
}

function extractColumns(records: Record<string, unknown>[]): string[] {
  const columnSet = new Set<string>()

  for (const record of records) {
    const flattened = flattenRecord(record)
    for (const key of Object.keys(flattened)) {
      columnSet.add(key)
    }
  }

  const columns = Array.from(columnSet)
  if (columns.includes('Id')) {
    columns.splice(columns.indexOf('Id'), 1)
    columns.unshift('Id')
  }

  return columns
}

export function exportToCSV(records: Record<string, unknown>[]): string {
  if (records.length === 0) return ''

  const columns = extractColumns(records)
  const lines: string[] = []

  lines.push(columns.map(escapeCSV).join(','))

  for (const record of records) {
    const flattened = flattenRecord(record)
    const row = columns.map((col) => escapeCSV(flattened[col]))
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

export function exportToMarkdown(records: Record<string, unknown>[]): string {
  if (records.length === 0) return ''

  const columns = extractColumns(records)
  const lines: string[] = []

  lines.push('| ' + columns.map(escapeMarkdown).join(' | ') + ' |')

  lines.push('| ' + columns.map(() => '---').join(' | ') + ' |')

  for (const record of records) {
    const flattened = flattenRecord(record)
    const row = columns.map((col) => escapeMarkdown(flattened[col]))
    lines.push('| ' + row.join(' | ') + ' |')
  }

  return lines.join('\n')
}

export function exportToExcel(records: Record<string, unknown>[]): string {
  if (records.length === 0) return ''

  const columns = extractColumns(records)
  const lines: string[] = []

  lines.push(columns.join('\t'))

  for (const record of records) {
    const flattened = flattenRecord(record)
    const row = columns.map((col) => {
      const val = flattened[col]
      if (val === null || val === undefined) return ''
      return String(val).replace(/\t/g, ' ').replace(/\n/g, ' ')
    })
    lines.push(row.join('\t'))
  }

  return lines.join('\n')
}

export function exportRecords(
  records: Record<string, unknown>[],
  format: ExportFormat
): string {
  switch (format) {
    case 'csv':
      return exportToCSV(records)
    case 'markdown':
      return exportToMarkdown(records)
    case 'excel':
      return exportToExcel(records)
    default:
      return exportToCSV(records)
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (error) {
    console.warn('Failed to copy to clipboard:', error)
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      return true
    } catch {
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}
