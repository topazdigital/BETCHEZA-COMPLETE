import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPool, resetPool } from '@/lib/db'
import { fileStoreGet, fileStoreSet } from '@/lib/file-store'
import fs from 'fs'
import path from 'path'

interface DbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
  ssl: boolean
}

const CONFIG_KEY = 'db-config'
const STATE_DIR = path.join(process.cwd(), '.local', 'state', 'admin')
const CONFIG_FILE = path.join(STATE_DIR, `${CONFIG_KEY}.json`)

export async function GET() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const envHost = process.env.DB_HOST || process.env.MYSQL_HOST
    const envUser = process.env.DB_USER || process.env.MYSQL_USER
    const envDb   = process.env.DB_NAME || process.env.MYSQL_DATABASE
    const hasEnvVar = !!(envHost && envUser && envDb)

    const fileConfig = fileStoreGet<DbConfig | null>(CONFIG_KEY, null)
    const fromFile = !hasEnvVar && !!fileConfig
    const source: 'env' | 'file' | 'none' = hasEnvVar ? 'env' : fromFile ? 'file' : 'none'

    return NextResponse.json({
      source,
      hasEnvVar,
      config: hasEnvVar
        ? {
            host: envHost || '',
            port: parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306'),
            user: envUser || '',
            password: '••••••••••••',
            database: envDb || '',
            ssl: false,
          }
        : fileConfig ?? null,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    resetPool()
    const pool = getPool()
    if (!pool) {
      return NextResponse.json({ success: false, message: 'No MySQL database connection configured.' })
    }

    try {
      const conn = await pool.getConnection()
      await conn.query('SELECT 1')
      conn.release()
      return NextResponse.json({ success: true, message: 'MySQL connection successful!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ success: false, message: `Connection failed: ${msg}` })
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as DbConfig
    if (!body.host || !body.user || !body.database) {
      return NextResponse.json({ error: 'host, user and database are required' }, { status: 400 })
    }

    fileStoreSet<DbConfig>(CONFIG_KEY, {
      host: body.host,
      port: body.port || 3306,
      user: body.user,
      password: body.password || '',
      database: body.database,
      ssl: body.ssl || false,
    })

    resetPool()

    return NextResponse.json({ success: true, message: 'Configuration saved. Restart the server to fully apply.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      if (fs.existsSync(CONFIG_FILE)) fs.unlinkSync(CONFIG_FILE)
    } catch { /* ignore */ }

    resetPool()

    return NextResponse.json({ success: true, message: 'Database configuration removed.' })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
