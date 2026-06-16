import { History, Plus, RefreshCw, Save, TimerReset } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../api/client.js'
import { licenseStatuses, licenseTypes } from '../api/options.js'
import { EmptyState } from '../components/EmptyState.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'

const initialForm = {
  name: '',
  license_no: '',
  license_type: 'business',
  issuing_authority: '',
  owner_department: '',
  keeper: '',
  issue_date: '',
  expiry_date: '',
  reminder_days: 30,
  status: 'active',
  notes: '',
}

export function LicensePage({ licenses, reload, notify, onNavigate }) {
  const [form, setForm] = useState(initialForm)
  const [filters, setFilters] = useState({ search: '', status: '', showHistory: false })
  const [saving, setSaving] = useState(false)
  const [historyTarget, setHistoryTarget] = useState(null)
  const [historyData, setHistoryData] = useState(null)

  const filteredLicenses = useMemo(
    () =>
      licenses.filter((item) => {
        const keyword = filters.search.trim().toLowerCase()
        const matchKeyword =
          !keyword ||
          [item.name, item.license_no, item.issuing_authority, item.owner_department]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        const matchStatus =
          !filters.status || item.computed_status === filters.status || item.status === filters.status
        const matchHistory = filters.showHistory ? true : item.is_current_version !== false
        return matchKeyword && matchStatus && matchHistory
      }),
    [licenses, filters],
  )

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await api.createLicense(form)
      setForm(initialForm)
      await reload()
      notify('证照已录入')
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }

  const openHistory = async (item) => {
    setHistoryTarget(item)
    try {
      const data = await api.getLicenseHistory(item.id)
      setHistoryData(Array.isArray(data) ? data : data.results || [])
    } catch (error) {
      notify(error.message)
      setHistoryData([])
    }
  }

  const closeHistory = () => {
    setHistoryTarget(null)
    setHistoryData(null)
  }

  const goToRenewal = (item) => {
    if (item.has_active_renewal) {
      notify('该证照已有进行中的续期申请')
    }
    if (onNavigate) {
      onNavigate('renewals')
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">License Registry</p>
          <h1>证照录入与台账</h1>
        </div>
        <button className="icon-button" type="button" onClick={reload} title="刷新">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="content-grid form-and-table">
        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-title">
            <Plus size={18} />
            <h2>新增证照</h2>
          </div>
          <div className="form-grid">
            <Field label="证照名称" value={form.name} onChange={(value) => setField('name', value)} required />
            <Field label="证照编号" value={form.license_no} onChange={(value) => setField('license_no', value)} required />
            <SelectField label="证照类型" value={form.license_type} options={licenseTypes} onChange={(value) => setField('license_type', value)} />
            <Field label="发证机关" value={form.issuing_authority} onChange={(value) => setField('issuing_authority', value)} required />
            <Field label="归属部门" value={form.owner_department} onChange={(value) => setField('owner_department', value)} required />
            <Field label="保管人" value={form.keeper} onChange={(value) => setField('keeper', value)} />
            <Field label="发证日期" type="date" value={form.issue_date} onChange={(value) => setField('issue_date', value)} required />
            <Field label="到期日期" type="date" value={form.expiry_date} onChange={(value) => setField('expiry_date', value)} required />
            <Field label="提醒天数" type="number" value={form.reminder_days} onChange={(value) => setField('reminder_days', Number(value))} required />
            <SelectField label="状态" value={form.status} options={licenseStatuses} onChange={(value) => setField('status', value)} />
          </div>
          <label className="field full">
            <span>备注</span>
            <textarea value={form.notes} onChange={(event) => setField('notes', event.target.value)} />
          </label>
          <button className="primary-button" disabled={saving} type="submit">
            <Save size={17} />
            <span>{saving ? '保存中' : '保存证照'}</span>
          </button>
        </form>

        <div className="panel table-panel">
          <div className="table-toolbar">
            <input
              placeholder="搜索名称、编号、机关、部门"
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">全部状态</option>
              {licenseStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={filters.showHistory}
                onChange={(event) => setFilters((c) => ({ ...c, showHistory: event.target.checked }))}
              />
              <span>显示历史版本</span>
            </label>
          </div>
          {filteredLicenses.length ? (
            <div className="data-table">
              <div className="table-head license-row">
                <span>证照</span>
                <span>部门</span>
                <span>到期</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {filteredLicenses.map((item) => (
                <div className="table-row license-row" key={item.id}>
                  <div>
                    <strong>
                      {item.name}
                      {item.version > 1 && <span className="version-tag">v{item.version}</span>}
                    </strong>
                    <span>
                      {item.license_no}
                      {item.is_current_version === false && <em className="history-tag">（历史）</em>}
                    </span>
                    {item.active_renewal_status && (
                      <span className={`renewal-tag renewal-${item.active_renewal_status.status}`}>
                        续期：{item.active_renewal_status.status_display}
                      </span>
                    )}
                  </div>
                  <span>{item.owner_department}</span>
                  <span>{item.expiry_date}</span>
                  <StatusBadge status={item.computed_status} />
                  <div className="row-actions">
                    <button
                      className="chip-button"
                      type="button"
                      onClick={() => openHistory(item)}
                      title="查看历史版本"
                    >
                      <History size={14} /> 历史
                    </button>
                    {item.is_current_version !== false && (
                      <button
                        className={`chip-button ${item.has_active_renewal ? 'chip-warning' : ''}`}
                        type="button"
                        onClick={() => goToRenewal(item)}
                      >
                        <TimerReset size={14} /> {item.has_active_renewal ? '续期中' : '续期'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无证照" description="请先录入企业证照信息。" />
          )}
        </div>
      </div>

      {historyTarget && historyData && (
        <div className="modal-backdrop" onClick={closeHistory}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>证照历史版本 - {historyTarget.name}</h3>
              <button className="icon-button" type="button" onClick={closeHistory}>×</button>
            </div>
            <div className="modal-body">
              <div className="data-table">
                <div className="table-head license-row">
                  <span>版本</span>
                  <span>证照编号</span>
                  <span>发证日期</span>
                  <span>到期日期</span>
                  <span>状态</span>
                </div>
                {historyData.map((h) => (
                  <div className="table-row license-row" key={h.id}>
                    <div>
                      <strong>v{h.version}</strong>
                      <span>{h.is_current_version !== false ? '（当前）' : ''}</span>
                    </div>
                    <span>{h.license_no}</span>
                    <span>{h.issue_date}</span>
                    <span>{h.expiry_date}</span>
                    <StatusBadge status={h.computed_status} />
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="primary-button" type="button" onClick={closeHistory}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  )
}

function SelectField({ label, value, options, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}
