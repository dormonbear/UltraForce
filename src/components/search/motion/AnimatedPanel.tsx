import type { CSSProperties, ReactNode } from 'react'
import { useAnimatedHeight } from './useAnimatedHeight'
import { useViewTransition } from './useViewTransition'

export default function AnimatedPanel({
  view,
  children,
  footer
}: {
  view: 'search' | 'picker' | 'settings'
  children: ReactNode
  footer: ReactNode
}) {
  const { innerRef, height } = useAnimatedHeight()
  const { outgoing, direction } = useViewTransition(view, children)
  const active = { view, content: children }
  const views = !outgoing ? [active] : view < outgoing.view ? [active, outgoing] : [outgoing, active]

  return (
    <div className="search-floating-panel">
      <div className="search-panel-height" style={{ height }}>
        <div className="search-panel-inner" ref={innerRef}>
          <div
            className="search-panel-views"
            data-switching={direction !== 0 || undefined}
            style={{ '--uf-direction': direction } as CSSProperties}
          >
            {views.map((layer) => {
              const exiting = layer.view !== view
              return (
                <div
                  key={layer.view}
                  className="search-panel-view"
                  data-view={layer.view}
                  data-exiting={exiting || undefined}
                  aria-hidden={exiting || undefined}
                  inert={exiting}
                >
                  {layer.content}
                </div>
              )
            })}
          </div>
          {footer}
        </div>
      </div>
    </div>
  )
}
