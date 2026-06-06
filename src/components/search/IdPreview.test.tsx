import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import IdPreview from './IdPreview'

vi.mock('~lib/record-preview', () => ({
  fetchRecordPreview: vi.fn()
}))

import { fetchRecordPreview } from '~lib/record-preview'
const mockFetchPreview = vi.mocked(fetchRecordPreview)

const TEST_ID = '001000000000001AAA'
const TEST_HOST = 'test.salesforce.com'

describe('IdPreview', () => {
  beforeEach(() => {
    mockFetchPreview.mockReset()
    cleanup()
  })

  it('renders loading state initially', () => {
    mockFetchPreview.mockReturnValue(new Promise(() => {})) // never resolves

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    expect(screen.getByText(TEST_ID)).toBeTruthy()
    expect(screen.getByText('Resolving record...')).toBeTruthy()
  })

  it('announces the loading state via a polite live region', () => {
    mockFetchPreview.mockReturnValue(new Promise(() => {}))

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('announces the error state via an alert live region', async () => {
    mockFetchPreview.mockResolvedValue(null)

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy()
    })
  })

  it('renders resolved preview with object type and name', async () => {
    mockFetchPreview.mockResolvedValue({
      id: TEST_ID,
      objectType: 'Account',
      name: 'Acme Corp',
      fetchedAt: Date.now()
    })

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Account: Acme Corp')).toBeTruthy()
    })
    expect(screen.getByText(TEST_ID)).toBeTruthy()
    expect(screen.getByLabelText('Account')).toBeTruthy()
  })

  it('renders error state when preview returns "Record not found"', async () => {
    mockFetchPreview.mockResolvedValue({
      id: TEST_ID,
      objectType: 'Unknown',
      name: 'Record not found',
      fetchedAt: Date.now()
    })

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Unknown: Record not found')).toBeTruthy()
    })
  })

  it('renders fallback when preview returns null', async () => {
    mockFetchPreview.mockResolvedValue(null)

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Could not resolve record')).toBeTruthy()
    })
    expect(screen.getByText(/open anyway/)).toBeTruthy()
  })

  it('calls fetchRecordPreview with correct arguments', () => {
    mockFetchPreview.mockReturnValue(new Promise(() => {}))

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    expect(mockFetchPreview).toHaveBeenCalledWith(
      TEST_HOST,
      TEST_ID,
      expect.any(AbortSignal)
    )
  })

  it('aborts previous request when recordId changes', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort')
    mockFetchPreview.mockReturnValue(new Promise(() => {}))

    const { rerender } = render(
      <IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />
    )

    rerender(
      <IdPreview recordId="003000000000001AAA" sfHost={TEST_HOST} onNavigate={vi.fn()} />
    )

    expect(abortSpy).toHaveBeenCalled()
    abortSpy.mockRestore()
  })

  it('shows "Enter" keyboard hint', () => {
    mockFetchPreview.mockReturnValue(new Promise(() => {}))

    render(<IdPreview recordId={TEST_ID} sfHost={TEST_HOST} onNavigate={vi.fn()} />)

    expect(screen.getByText('Enter')).toBeTruthy()
  })
})
