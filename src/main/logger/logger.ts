import * as fs from 'fs'
import * as path from 'path'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL'

interface LogEntry {
  timestamp: string
  level: LogLevel
  source: string
  message: string
}

class Logger {
  private logDir: string
  private listeners: ((entry: LogEntry) => void)[] = []

  constructor(logDir: string) {
    this.logDir = logDir
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
  }

  onLog(listener: (entry: LogEntry) => void) {
    this.listeners.push(listener)
  }

  private write(level: LogLevel, source: string, message: string) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      source,
      message
    }

    // Never log sensitive data
    const sanitized = this.sanitize(message)
    const line = `[${entry.timestamp}] [${level}] [${source}] ${sanitized}\n`

    try {
      const logFile = path.join(this.logDir, `${source}.log`)
      fs.appendFileSync(logFile, line, 'utf8')
    } catch {}

    for (const listener of this.listeners) {
      try { listener(entry) } catch {}
    }
  }

  private sanitize(message: string): string {
    // Remove tokens, passwords, secrets
    return message
      .replace(/access_token[=:]\s*\S+/gi, 'access_token=***')
      .replace(/refresh_token[=:]\s*\S+/gi, 'refresh_token=***')
      .replace(/password[=:]\s*\S+/gi, 'password=***')
      .replace(/Bearer\s+\S+/gi, 'Bearer ***')
      .replace(/XBL3\.0\s+\S+/gi, 'XBL3.0 ***')
  }

  debug(source: string, message: string) { this.write('DEBUG', source, message) }
  info(source: string, message: string) { this.write('INFO', source, message) }
  warn(source: string, message: string) { this.write('WARN', source, message) }
  error(source: string, message: string) { this.write('ERROR', source, message) }
  fatal(source: string, message: string) { this.write('FATAL', source, message) }
}

export default Logger
export type { LogEntry, LogLevel }
