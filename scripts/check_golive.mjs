import fs from 'fs'
import path from 'path'
import { chromium } from 'playwright'

const url = 'http://localhost:5173/go-live'
const outDir = path.resolve(process.cwd(), 'tmp')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
const screenshotPath = path.join(outDir, 'go-live.png')

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const consoleMsgs = []
  page.on('console', (msg) => {
    consoleMsgs.push({ type: msg.type(), text: msg.text() })
    console.log(`[console:${msg.type()}] ${msg.text()}`)
  })
  page.on('pageerror', (err) => {
    consoleMsgs.push({ type: 'pageerror', text: String(err) })
    console.error('[pageerror]', err)
  })

  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 })
    console.log('HTTP status:', resp && resp.status())
    await page.waitForTimeout(3000)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log('Saved screenshot to', screenshotPath)
  } catch (err) {
    console.error('Error loading page:', err)
    process.exitCode = 2
  } finally {
    await browser.close()
  }

  // Summarize console
  const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror')
  console.log('Console messages captured:', consoleMsgs.length, 'errors:', errors.length)
  if (errors.length > 0) {
    console.log('--- Errors ---')
    errors.slice(0, 20).forEach(e => console.log(e.type, e.text))
    process.exitCode = 1
  }
}

run()
