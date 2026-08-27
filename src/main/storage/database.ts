import Database from 'better-sqlite3'
import * as path from 'path'
import * as fs from 'fs'

export class Storage {
  private db: Database.Database
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
    this.ensureDirs()
    this.db = new Database(path.join(basePath, 'launcher.db'))
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initTables()
  }

  private ensureDirs() {
    const dirs = ['instances', 'versions', 'downloads', 'java', 'auth', 'logs', 'cache']
    for (const d of dirs) {
      const p = path.join(this.basePath, d)
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true })
    }
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS installed_versions (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS instances (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS download_state (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `)
  }

  // Settings
  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
    return row?.value ?? null
  }

  setSetting(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
  }

  getAllSettings(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as any[]
    const result: Record<string, string> = {}
    for (const row of rows) result[row.key] = row.value
    return result
  }

  // Installed versions
  getInstalledVersions(): Record<string, any> {
    const rows = this.db.prepare('SELECT id, data FROM installed_versions').all() as any[]
    const result: Record<string, any> = {}
    for (const row of rows) result[row.id] = JSON.parse(row.data)
    return result
  }

  saveInstalledVersion(id: string, data: any): void {
    this.db.prepare('INSERT OR REPLACE INTO installed_versions (id, data) VALUES (?, ?)').run(id, JSON.stringify(data))
  }

  removeInstalledVersion(id: string): void {
    this.db.prepare('DELETE FROM installed_versions WHERE id = ?').run(id)
  }

  // Instances
  getInstances(): any[] {
    const rows = this.db.prepare('SELECT data FROM instances').all() as any[]
    return rows.map(r => JSON.parse(r.data))
  }

  getInstance(id: string): any | null {
    const row = this.db.prepare('SELECT data FROM instances WHERE id = ?').get(id) as any
    return row ? JSON.parse(row.data) : null
  }

  saveInstance(instance: any): void {
    this.db.prepare('INSERT OR REPLACE INTO instances (id, data) VALUES (?, ?)').run(instance.id, JSON.stringify(instance))
  }

  deleteInstance(id: string): void {
    this.db.prepare('DELETE FROM instances WHERE id = ?').run(id)
  }

  // Download state
  getDownloadState(id: string): any | null {
    const row = this.db.prepare('SELECT data FROM download_state WHERE id = ?').get(id) as any
    return row ? JSON.parse(row.data) : null
  }

  saveDownloadState(id: string, data: any): void {
    this.db.prepare('INSERT OR REPLACE INTO download_state (id, data) VALUES (?, ?)').run(id, JSON.stringify(data))
  }

  clearDownloadState(id: string): void {
    this.db.prepare('DELETE FROM download_state WHERE id = ?').run(id)
  }

  close(): void {
    this.db.close()
  }
}

export default Storage
