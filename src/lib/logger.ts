const IS_PRODUCTION = process.env.NODE_ENV === 'production'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface Logger {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

function createLogger(prefix: string = 'UltraForce'): Logger {
  const format = (level: LogLevel, args: any[]) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8)
    return [`[${prefix}][${timestamp}]`, ...args]
  }

  return {
    debug: (...args: any[]) => {
      if (!IS_PRODUCTION) {
        console.log(...format('debug', args))
      }
    },
    info: (...args: any[]) => {
      if (!IS_PRODUCTION) {
        console.log(...format('info', args))
      }
    },
    warn: (...args: any[]) => {
      if (!IS_PRODUCTION) {
        console.warn(...format('warn', args))
      }
    },
    error: (...args: any[]) => {
      // Errors are always logged
      console.error(...format('error', args))
    }
  }
}

export const logger = createLogger()
export default logger
