import { logger } from './logger'

export class TypedEventEmitter<EventMap extends Record<string, any>> {
  private handlers = new Map<keyof EventMap, Set<(data: any) => void>>()

  on<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler as (data: any) => void)
  }

  off<K extends keyof EventMap>(event: K, handler: (data: EventMap[K]) => void): void {
    const set = this.handlers.get(event)
    if (set) {
      set.delete(handler as (data: any) => void)
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const set = this.handlers.get(event)
    if (set) {
      for (const handler of set) {
        try {
          handler(data)
        } catch (error) {
          logger.error(`Event handler error for ${String(event)}:`, error)
        }
      }
    }
  }

  clearAll(): void {
    this.handlers.clear()
  }
}
