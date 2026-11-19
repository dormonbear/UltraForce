import { browserLocale, t } from './i18n'

export const MODAL_CONTAINER_PREFIX = 'ultraforce-modal'
export const MODAL_CONTAINER_SELECTOR = `[id^="${MODAL_CONTAINER_PREFIX}"]`

export function scheduleExtensionUpdatedNotice(): void {
  setTimeout(() => {
    if (document.querySelector(MODAL_CONTAINER_SELECTOR)) return

    const host = document.createElement('div')
    host.id = `${MODAL_CONTAINER_PREFIX}-extension-updated`
    host.lang = browserLocale()
    const shadow = host.attachShadow({ mode: 'open' })
    const notice = document.createElement('aside')
    notice.setAttribute('role', 'alert')
    notice.style.cssText = [
      'position: fixed',
      'inset: 1rem 1rem auto auto',
      'max-width: calc(100vw - 4rem)',
      'z-index: 2147483647',
      'padding: 1rem',
      'border-radius: 0.5rem',
      'background: #1c1c21',
      'color: #fff',
      'font: 1rem/1.4 system-ui, sans-serif'
    ].join(';')
    const title = document.createElement('h2')
    title.style.cssText = 'font: inherit; font-weight: 600; margin: 0'
    title.textContent = t('UltraForce was updated')
    const description = document.createElement('p')
    description.textContent = t('Refresh this page to keep using it.')
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = t('Refresh')
    button.addEventListener('click', () => {
      try {
        location.reload()
      } catch {
        // The page may already be leaving. / 页面可能正在离开。
      }
    })
    notice.append(title, description, button)
    shadow.append(notice)
    document.body?.append(host)
  }, 150)
}
