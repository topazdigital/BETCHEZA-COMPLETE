import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getPool } from '@/lib/db'

export async function GET() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const hasDb = !!process.env.DATABASE_URL
    const source: 'env' | 'none' = hasDb ? 'env' : 'none'

    return NextResponse.json({
      source,
      hasEnvVar: hasDb,
      config: hasDb ? {
        host: process.env.PGHOST || 'managed by Replit',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'managed by Replit',
        password: '••••••••••••',
        database: process.env.PGDATABASE || 'managed by Replit',
        ssl: false,
      } : null,
    })
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const session = await getCurrentUser()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pool = getPool()
    if (!pool) {
      return NextResponse.json({ success: false, message: 'No database connection configured.' })
    }

    try {
      await pool.query('SELECT 1')
      return NextResponse.json({ success: true, message: 'PostgreSQL connection successful!' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ success: false, message: `Connection failed: ${msg}` })
    }
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT() {
  return NextResponse.json({ error: 'Database is managed by Replit. Configure via environment variables.' }, { status: 400 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Database is managed by Replit.' }, { status: 400 })
}
