import { CalendarClock, FileWarning, Handshake, TimerReset, RefreshCw } from 'lucide-react'

import { EmptyState } from '../components/EmptyState.jsx'
import { MetricCard } from '../components/MetricCard.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'

export function DashboardPage({ stats, loading, renewals, onNavigate }) {
  const upcoming = stats?.upcoming_expiries || []
  const activeRenewals = (renewals || []).filter(
    (r) => ['pending', 'reviewing', 'approved', 'in_progress'].includes(r.status),
  )

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>证照风险工作台</h1>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="证照总数" value={stats?.total_licenses} />
        <MetricCard label="即将到期" value={stats?.expiring_licenses} tone="warning" />
        <MetricCard label="已到期" value={stats?.expired_licenses} tone="danger" />
        <MetricCard label="续期中" value={stats?.active_renewals || 0} tone="info" />
        <MetricCard label="逾期未还" value={stats?.overdue_returns} tone="danger" />
      </div>

      <div className="content-grid two-col">
        <div className="panel">
          <div className="panel-title">
            <CalendarClock size={18} />
            <h2>近期到期提醒</h2>
          </div>
          {loading ? (
            <div className="skeleton-list" />
          ) : upcoming.length ? (
            <div className="record-list">
              {upcoming.map((item) => (
                <div className="record-row" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.issuing_authority}</span>
                    {item.active_renewal_status && (
                      <span
                        className={`renewal-tag renewal-${item.active_renewal_status.status}`}
                      >
                        续期：{item.active_renewal_status.status_display}
                      </span>
                    )}
                  </div>
                  <div className="row-right">
                    <StatusBadge status={item.computed_status} />
                    <span>{item.days_until_expiry} 天</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无到期提醒" description="当前证照没有进入提醒窗口。" />
          )}
        </div>

        <div className="panel checklist">
          <div className="panel-title">
            <TimerReset size={18} />
            <h2>日常管理重点</h2>
          </div>
          <div className="task-line">
            <RefreshCw size={18} />
            <span>
              处理进行中的续期申请（{activeRenewals.length}）
              {activeRenewals.length > 0 && (
                <a className="link-like" onClick={() => onNavigate && onNavigate('renewals')}>
                  前往处理
                </a>
              )}
            </span>
          </div>
          <div className="task-line">
            <FileWarning size={18} />
            <span>核对即将到期证照并准备续期材料</span>
          </div>
          <div className="task-line">
            <Handshake size={18} />
            <span>跟进借出中证照的预计归还时间</span>
          </div>
          <div className="task-line">
            <CalendarClock size={18} />
            <span>按部门维护保管人和发证机关信息</span>
          </div>
        </div>
      </div>

      {activeRenewals.length > 0 && (
        <div className="panel">
          <div className="panel-title">
            <RefreshCw size={18} />
            <h2>进行中的续期</h2>
          </div>
          <div className="record-list">
            {activeRenewals.map((item) => (
              <div className="record-row" key={item.id}>
                <div>
                  <strong>{item.license_name}</strong>
                  <span>申请人：{item.applicant} / {item.applicant_department}</span>
                </div>
                <div className="row-right">
                  <StatusBadge status={item.status} />
                  <span>原到期：{item.license_expiry_date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
