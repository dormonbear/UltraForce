import { useState, type KeyboardEvent, type RefObject } from 'react'
import { splitCommandChip } from '~lib/command-chip'
import { getMatchingCommands } from '~lib/command-parser'
import type { SearchCommand } from '~types'
import { getScopeDetails } from './command-scope'

export function useCommandPanel(
  query: string,
  commands: Record<string, SearchCommand>,
  unsupportedTypes: string[],
  onChoose: (query: string) => void,
  inputRef: RefObject<HTMLInputElement | null>
) {
  const [isOpen, setIsOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [highlightedKey, highlight] = useState<string | null>(null)
  const canOpen = splitCommandChip(query, commands).remainder === ''
  const needle = filter.trim().toLowerCase()
  const options = !isOpen
    ? []
    : getMatchingCommands(':', commands, unsupportedTypes)
        .map((command) => ({ command, ...getScopeDetails(command) }))
        .filter(({ command, title, label }) =>
          [`:${command.key}`, title, label].some((text) => text.toLowerCase().includes(needle))
        )
  const selectedIndex = Math.max(
    0,
    options.findIndex(({ command }) => command.key === highlightedKey)
  )
  const selectedKey = options[selectedIndex]?.command.key ?? null

  function open() {
    setFilter('')
    highlight(null)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  function close() {
    if (!isOpen) return
    setIsOpen(false)
    inputRef.current?.focus()
  }

  function choose(key: string) {
    onChoose(`:${key} `)
    close()
  }

  function changeFilter(value: string) {
    setFilter(value)
    highlight(null)
  }

  function handleKeyDown(event: KeyboardEvent): boolean {
    const { key, shiftKey } = event
    const isTab = key === 'Tab' && !shiftKey

    if (!isOpen) {
      if (!isTab || !canOpen) return false
      open()
    } else if (isTab || key === 'Escape') {
      close()
    } else if (key === 'Enter') {
      if (selectedKey) choose(selectedKey)
    } else if (key === 'ArrowDown' || key === 'ArrowUp') {
      if (options.length) {
        const step = key === 'ArrowDown' ? 1 : -1
        highlight(options[(selectedIndex + step + options.length) % options.length].command.key)
      }
    } else {
      return false
    }

    event.preventDefault()
    event.stopPropagation()
    return true
  }

  return {
    isOpen,
    canOpen,
    filter,
    options,
    selectedKey,
    changeFilter,
    highlight,
    choose,
    close,
    handleKeyDown
  }
}
