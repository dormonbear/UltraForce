import React, { useState, useEffect, useRef } from 'react'
import { fetchRecordPreview, type RecordPreview } from '~lib/record-preview'

interface IdPreviewProps {
  recordId: string
  sfHost: string
  onNavigate: () => void
}

const OBJECT_ICONS: Record<string, string> = {
  Account: 'A',
  Contact: 'C',
  Opportunity: 'O',
  Lead: 'L',
  Case: 'CS',
  User: 'U',
  Task: 'T',
  Event: 'E',
  Campaign: 'CA',
  Product2: 'P',
  Order: 'OR',
  Contract: 'CT',
  Solution: 'SO',
  Unknown: '?'
}

function getObjectIcon(objectType: string): string {
  return OBJECT_ICONS[objectType] ?? objectType.substring(0, 2).toUpperCase()
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'resolved'; preview: RecordPreview }
  | { status: 'error'; message: string }

export default function IdPreview({ recordId, sfHost, onNavigate }: IdPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    abortRef.current = controller
    setState({ status: 'loading' })

    fetchRecordPreview(sfHost, recordId, controller.signal)
      .then((preview) => {
        if (controller.signal.aborted) return
        if (preview) {
          setState({ status: 'resolved', preview })
        } else {
          setState({ status: 'error', message: 'Could not resolve record' })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', message: 'Could not resolve record' })
        }
      })

    return () => {
      controller.abort()
    }
  }, [recordId, sfHost])

  return (
    <div className="id-preview" role="region" aria-label="Record preview">
      {state.status === 'loading' && (
        <div className="id-preview-loading" role="status" aria-live="polite">
          <div className="id-preview-id">{recordId}</div>
          <div className="id-preview-hint">Resolving record...</div>
        </div>
      )}

      {state.status === 'resolved' && (
        <div className="id-preview-resolved">
          <div className="id-preview-badge" aria-label={state.preview.objectType}>
            {getObjectIcon(state.preview.objectType)}
          </div>
          <div className="id-preview-details">
            <div className="id-preview-name">
              {state.preview.objectType}: {state.preview.name}
            </div>
            <div className="id-preview-id">{recordId}</div>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="id-preview-error" role="alert">
          <div className="id-preview-id">{recordId}</div>
          <div className="id-preview-hint">{state.message}</div>
        </div>
      )}

      <div className="id-preview-action">
        Press{' '}
        <kbd
          className="id-preview-kbd"
          onClick={onNavigate}
        >
          Enter
        </kbd>{' '}
        to open{state.status === 'error' ? ' anyway' : ''}
      </div>
    </div>
  )
}
