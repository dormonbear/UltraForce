import { createRoot } from 'react-dom/client'
import { logger } from './logger'

// React's default reporters log raw error objects independently of our logger.
// The root callbacks discard errors and component stacks in every build.
const reportRootError = () => logger.error()

export function createPrivateRoot(container: Parameters<typeof createRoot>[0]) {
  return createRoot(container, {
    onCaughtError: reportRootError,
    onUncaughtError: reportRootError,
    onRecoverableError: reportRootError
  })
}
