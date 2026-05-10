import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { query } from '@/lib/db'

export async function GET() {
  const cwd = process.cwd()
  const stateDir = path.join(cwd, '.local', 'state', 'admin')
  const gwFile = path.join(stateDir, 'payment-gateways.json')
  const dirExists = fs.existsSync(stateDir)
  const fileExists = fs.existsSync(gwFile)
  let fileContents: unknown = null
  let fileError: string | null = null
  try {
    if (fileExists) fileContents = JSON.parse(fs.readFileSync(gwFile, 'utf8'))
  } catch (e) { fileError = String(e) }

  let mysqlStatus = 'not connected'
  let mysqlRow: unknown = null
  let mysqlError: string | null = null
  try {
    const result = await query<{ value: string }>(
      "SELECT value FROM admin_settings WHERE name = 'payment_gateways' LIMIT 1"
    )
    if (result.rows?.length) {
      mysqlStatus = 'connected - row found'
      const parsed = JSON.parse(result.rows[0].value)
      mysqlRow = Array.isArray(parsed)
        ? parsed.map((g: { id: string; credentials?: Record<string, string> }) => ({
            id: g.id,
            credentials: Object.fromEntries(
              Object.entries(g.credentials || {}).map(([k, v]) => [k, v ? `[${v.length} chars]` : 'empty'])
            )
          }))
        : parsed
    } else {
      mysqlStatus = 'connected - no row'
    }
  } catch (e) {
    mysqlStatus = 'error'
    mysqlError = String(e)
  }

  // Write test
  let writeTest = 'not tried'
  try {
    fs.mkdirSync(stateDir, { recursive: true })
    fs.writeFileSync(path.join(stateDir, 'write-test.txt'), new Date().toISOString())
    writeTest = 'success'
  } catch (e) { writeTest = `FAILED: ${e}` }

  return NextResponse.json({
    cwd,
    stateDir,
    dirExists,
    gwFileExists: fileExists,
    fileError,
    gwFileCredentials: Array.isArray(fileContents)
      ? (fileContents as Array<{ id: string; credentials?: Record<string, string> }>).map((g) => ({
          id: g.id,
          credentials: Object.fromEntries(
            Object.entries(g.credentials || {}).map(([k, v]) => [k, v ? `[${v.length} chars]` : 'empty'])
          )
        }))
      : fileContents,
    mysqlStatus,
    mysqlRow,
    mysqlError,
    writeTest,
  })
}
