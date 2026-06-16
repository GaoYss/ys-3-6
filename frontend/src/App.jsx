import { BarChart3, ClipboardList, FileBadge2, Handshake, LayoutDashboard, TimerReset } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from './api/client.js'
import { AppShell } from './components/AppShell.jsx'
import { Toast } from './components/Toast.jsx'
import { BorrowPage } from './pages/BorrowPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { LicensePage } from './pages/LicensePage.jsx'
import { RenewalPage } from './pages/RenewalPage.jsx'
import { StatsPage } from './pages/StatsPage.jsx'

const navItems = [
  { key: 'dashboard', label: '工作台', icon: LayoutDashboard },
  { key: 'licenses', label: '证照录入', icon: FileBadge2 },
  { key: 'renewals', label: '续期管理', icon: TimerReset },
  { key: 'borrows', label: '借出归还', icon: Handshake },
  { key: 'stats', label: '到期统计', icon: BarChart3 },
]

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [licenses, setLicenses] = useState([])
  const [borrowRecords, setBorrowRecords] = useState([])
  const [renewals, setRenewals] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const loadAll = async () => {
    setLoading(true)
    try {
      const [licenseData, borrowData, renewalData, statsData] = await Promise.all([
        api.listLicenses(),
        api.listBorrowRecords(),
        api.listRenewals(),
        api.stats(),
      ])
      setLicenses(licenseData.results || licenseData)
      setBorrowRecords(borrowData.results || borrowData)
      setRenewals(renewalData.results || renewalData)
      setStats(statsData)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll().catch((error) => setToast(error.message))
  }, [])

  const navigate = (key) => {
    if (navItems.find((n) => n.key === key)) {
      setActivePage(key)
    }
  }

  const context = useMemo(
    () => ({
      licenses,
      borrowRecords,
      renewals,
      stats,
      loading,
      reload: loadAll,
      notify: setToast,
      onNavigate: navigate,
    }),
    [licenses, borrowRecords, renewals, stats, loading],
  )

  const page = {
    dashboard: <DashboardPage {...context} />,
    licenses: <LicensePage {...context} />,
    renewals: <RenewalPage {...context} />,
    borrows: <BorrowPage {...context} />,
    stats: <StatsPage {...context} />,
  }[activePage]

  return (
    <>
      <AppShell
        activePage={activePage}
        navItems={navItems}
        onNavigate={setActivePage}
        title="企业证照管理系统"
        subtitle="证照台账、到期提醒、续期流程、借出归还与统计分析"
        headerIcon={ClipboardList}
      >
        {page}
      </AppShell>
      <Toast message={toast} onClose={() => setToast('')} />
    </>
  )
}
