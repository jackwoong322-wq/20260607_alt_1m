import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { fetchDashboardManifest, fetchDashboardInitialData, fetchCycleData } from './lib/dataFetcher'

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

type DashboardMeta = {
  data_version?: string
  generated_at?: string
  cache_status?: string
}

type DashboardInitialResponse = DashboardMeta & {
  data: unknown
}

function assertPlaceholderReplaced(html: string) {
  const remainingPlaceholders = [
    '"__LEGACY_CHART_DATA__"',
    '"__DASHBOARD_META__"',
    '"__DASHBOARD_MANIFEST__"',
    '"__API_BASE_URL__"',
  ].filter((placeholder) => html.includes(placeholder))

  if (remainingPlaceholders.length > 0) {
    throw new Error(`Failed to inject legacy shell placeholders: ${remainingPlaceholders.join(', ')}`)
  }
}

function buildShell(html: string, manifestResponse: unknown, initialResponse: DashboardInitialResponse) {
  const meta: DashboardMeta = {
    data_version: initialResponse.data_version,
    generated_at: initialResponse.generated_at,
    cache_status: initialResponse.cache_status,
  }

  const shellHtml = html
    .replace('"__LEGACY_CHART_DATA__"', JSON.stringify(initialResponse.data))
    .replace('"__DASHBOARD_META__"', JSON.stringify(meta))
    .replace('"__DASHBOARD_MANIFEST__"', JSON.stringify(manifestResponse))
    .replace('"__API_BASE_URL__"', JSON.stringify(BASE_URL))

  assertPlaceholderReplaced(shellHtml)
  return shellHtml
}

export default function LegacyAnalyzerApp() {
  const [srcDoc, setSrcDoc] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    // Expose local fetcher to window for the legacy chart lazy loader
    ;(window as any).__fetchCycleData_frontend = fetchCycleData
    ;(window as any).__fetchDashboardManifest_frontend = fetchDashboardManifest
    ;(window as any).__fetchDashboardInitialData_frontend = fetchDashboardInitialData

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const [shellRes, manifestResponse, initialResponse] = await Promise.all([
          fetch('/legacy/chart-shell-v2.html'),
          fetchDashboardManifest(),
          fetchDashboardInitialData(),
        ])

        if (!shellRes.ok) {
          throw new Error('Failed to load legacy chart shell')
        }

        const shellHtml = await shellRes.text()
        if (!cancelled) {
          setSrcDoc(buildShell(shellHtml, manifestResponse, initialResponse as DashboardInitialResponse))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div style={styles.statusWrap}>
        <div style={styles.statusCard}>
          <div style={styles.statusEyebrow}>ALT/BTC CYCLE ANALYZER</div>
          <div style={styles.statusTitle}>Preparing the chart workspace</div>
          <div style={styles.statusText}>Loading cycle data, overlays, and comparison controls.</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.statusWrap}>
        <div style={styles.statusCard}>
          <div style={styles.statusEyebrow}>DATA CONNECTION</div>
          <div style={{ ...styles.statusTitle, color: '#f6465d' }}>Unable to load the analyzer</div>
          <div style={{ ...styles.statusText, color: '#94a3b8' }}>{error}</div>
        </div>
      </div>
    )
  }

  return (
    <iframe
      title="ALT/BTC Cycle Analyzer"
      srcDoc={srcDoc}
      style={styles.frame}
    />
  )
}

const styles: Record<string, CSSProperties> = {
  frame: {
    width: '100%',
    height: '100vh',
    border: 'none',
    display: 'block',
    background: '#0b0e14',
  },
  statusWrap: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: '#0b0e14',
    color: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace',
  },
  statusCard: {
    width: 'min(440px, calc(100vw - 40px))',
    border: '1px solid #232936',
    background: '#151922',
    padding: '20px 24px',
    borderRadius: 8,
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28)',
  },
  statusEyebrow: {
    marginBottom: 8,
    color: '#94a3b8',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.15em',
  },
  statusTitle: {
    color: '#f1f5f9',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '1.15rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  statusText: {
    marginTop: 8,
    color: '#94a3b8',
    fontSize: '0.84rem',
    lineHeight: 1.5,
  },
}
