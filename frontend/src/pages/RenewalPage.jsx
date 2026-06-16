import { CheckCircle2, Clock, Plus, RefreshCw, Save, Send, TimerReset, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'

import { api } from '../api/client.js'
import { renewalStatuses } from '../api/options.js'
import { EmptyState } from '../components/EmptyState.jsx'
import { StatusBadge } from '../components/StatusBadge.jsx'

function todayStr() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

const initialForm = {
  license: '',
  applicant: '',
  applicant_department: '',
  apply_date: todayStr(),
  reason: '',
  notes: '',
}

const initialActionForm = {
  reviewer: '',
  review_comments: '',
  new_issue_date: '',
  new_expiry_date: '',
  new_license_no: '',
}

export function RenewalPage({ licenses, renewals, reload, notify }) {
  const [form, setForm] = useState(initialForm)
  const [actionForm, setActionForm] = useState(initialActionForm)
  const [filters, setFilters] = useState({ search: '', status: '' })
  const [actionTarget, setActionTarget] = useState(null)
  const [actionType, setActionType] = useState(null)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)

  const currentLicenses = useMemo(
    () => licenses.filter((l) => l.is_current_version !== false),
    [licenses],
  )

  const filteredRenewals = useMemo(
    () =>
      (renewals || []).filter((item) => {
        const keyword = filters.search.trim().toLowerCase()
        const matchKeyword =
          !keyword ||
          [item.license_name, item.license_no, item.applicant, item.applicant_department]
            .join(' ')
            .toLowerCase()
            .includes(keyword)
        const matchStatus = !filters.status || item.status === filters.status
        return matchKeyword && matchStatus
      }),
    [renewals, filters],
  )

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const setActionField = (field, value) =>
    setActionForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!form.license) {
      notify('请选择要续期的证照')
      return
    }
    setSaving(true)
    try {
      await api.createRenewal(form)
      setForm({ ...initialForm, apply_date: todayStr() })
      await reload()
      notify('续期申请已创建')
    } catch (error) {
      notify(error.message)
    } finally {
      setSaving(false)
    }
  }

  const openAction = (item, type) => {
    setActionTarget(item)
    setActionType(type)
    setActionForm({ ...initialActionForm })
  }

  const closeAction = () => {
    setActionTarget(null)
    setActionType(null)
  }

  const executeAction = async () => {
    if (!actionTarget || !actionType) return
    setProcessing(true)
    try {
      if (actionType === 'submit') {
        await api.submitRenewal(actionTarget.id)
        notify('已提交审核')
      } else if (actionType === 'approve') {
        if (!actionForm.reviewer) {
          notify('请填写审核人')
          return
        }
        await api.approveRenewal(actionTarget.id, {
          reviewer: actionForm.reviewer,
          review_comments: actionForm.review_comments,
        })
        notify('已批准续期申请')
      } else if (actionType === 'reject') {
        if (!actionForm.reviewer) {
          notify('请填写审核人')
          return
        }
        await api.rejectRenewal(actionTarget.id, {
          reviewer: actionForm.reviewer,
          review_comments: actionForm.review_comments,
        })
        notify('已拒绝续期申请')
      } else if (actionType === 'start') {
        await api.startRenewal(actionTarget.id)
        notify('已进入续期流程')
      } else if (actionType === 'complete') {
        if (!actionForm.new_issue_date || !actionForm.new_expiry_date) {
          notify('请填写新发证日期和新到期日期')
          return
        }
        await api.completeRenewal(actionTarget.id, {
          new_issue_date: actionForm.new_issue_date,
          new_expiry_date: actionForm.new_expiry_date,
          new_license_no: actionForm.new_license_no,
        })
        notify('续期已完成，证照已更新')
      }
      closeAction()
      await reload()
    } catch (error) {
      notify(error.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">License Renewal</p>
          <h1>证照续期管理</h1>
        </div>
        <button className="icon-button" type="button" onClick={reload} title="刷新">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="content-grid form-and-table">
        <form className="panel form-panel" onSubmit={submit}>
          <div className="panel-title">
            <Plus size={18} />
            <h2>发起续期申请</h2>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>选择证照</span>
              <select
                value={form.license}
                onChange={(e) => setField('license', Number(e.target.value) || '')}
                required
              >
                <option value="">请选择证照</option>
                {currentLicenses.map((lic) => (
                  <option key={lic.id} value={lic.id}>
                    {lic.name} ({lic.license_no}) - 到期: {lic.expiry_date}
                  </option>
                ))}
              </select>
            </label>
            <Field label="申请人" value={form.applicant} onChange={(v) => setField('applicant', v)} required />
            <Field label="申请部门" value={form.applicant_department} onChange={(v) => setField('applicant_department', v)} required />
            <Field label="申请日期" type="date" value={form.apply_date} onChange={(v) => setField('apply_date', v)} required />
          </div>
          <label className="field full">
            <span>续期原因</span>
            <textarea value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
          </label>
          <label className="field full">
            <span>备注</span>
            <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </label>
          <button className="primary-button" disabled={saving} type="submit">
            <Save size={17} />
            <span>{saving ? '保存中' : '创建申请'}</span>
          </button>
        </form>

        <div className="panel table-panel">
          <div className="table-toolbar">
            <input
              placeholder="搜索证照、申请人、部门"
              value={filters.search}
              onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}
            >
              <option value="">全部状态</option>
              {renewalStatuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          {filteredRenewals.length ? (
            <div className="data-table">
              <div className="table-head renewal-row">
                <span>证照</span>
                <span>申请人</span>
                <span>申请日期</span>
                <span>原到期</span>
                <span>状态</span>
                <span>操作</span>
              </div>
              {filteredRenewals.map((item) => (
                <div className="table-row renewal-row" key={item.id}>
                  <div>
                    <strong>{item.license_name}</strong>
                    <span>{item.license_no}</span>
                  </div>
                  <span>{item.applicant} / {item.applicant_department}</span>
                  <span>{item.apply_date}</span>
                  <span>{item.license_expiry_date}</span>
                  <StatusBadge status={item.status} />
                  <div className="row-actions">
                    {item.status === 'pending' && (
                      <button
                        className="chip-button"
                        type="button"
                        onClick={() => openAction(item, 'submit')}
                      >
                        <Send size={14} /> 提交
                      </button>
                    )}
                    {item.status === 'reviewing' && (
                      <>
                        <button
                          className="chip-button chip-success"
                          type="button"
                          onClick={() => openAction(item, 'approve')}
                        >
                          <CheckCircle2 size={14} /> 批准
                        </button>
                        <button
                          className="chip-button chip-danger"
                          type="button"
                          onClick={() => openAction(item, 'reject')}
                        >
                          <XCircle size={14} /> 拒绝
                        </button>
                      </>
                    )}
                    {item.status === 'approved' && (
                      <>
                        <button
                          className="chip-button"
                          type="button"
                          onClick={() => openAction(item, 'start')}
                        >
                          <TimerReset size={14} /> 开始续期
                        </button>
                        <button
                          className="chip-button chip-success"
                          type="button"
                          onClick={() => openAction(item, 'complete')}
                        >
                          <CheckCircle2 size={14} /> 完成
                        </button>
                      </>
                    )}
                    {item.status === 'in_progress' && (
                      <button
                        className="chip-button chip-success"
                        type="button"
                        onClick={() => openAction(item, 'complete')}
                      >
                        <CheckCircle2 size={14} /> 完成续期
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="暂无续期申请" description="请先发起证照续期申请。" />
          )}
        </div>
      </div>

      {actionTarget && actionType && (
        <div className="modal-backdrop" onClick={closeAction}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{actionTitle(actionType, actionTarget.license_name)}</h3>
              <button className="icon-button" type="button" onClick={closeAction}>×</button>
            </div>
            <div className="modal-body">
              {(actionType === 'approve' || actionType === 'reject') && (
                <div className="form-grid">
                  <Field label="审核人" value={actionForm.reviewer} onChange={(v) => setActionField('reviewer', v)} required />
                  <label className="field full">
                    <span>审核意见</span>
                    <textarea
                      value={actionForm.review_comments}
                      onChange={(e) => setActionField('review_comments', e.target.value)}
                    />
                  </label>
                </div>
              )}
              {actionType === 'complete' && (
                <div className="form-grid">
                  <Field
                    label="新发证日期"
                    type="date"
                    value={actionForm.new_issue_date}
                    onChange={(v) => setActionField('new_issue_date', v)}
                    required
                  />
                  <Field
                    label="新到期日期"
                    type="date"
                    value={actionForm.new_expiry_date}
                    onChange={(v) => setActionField('new_expiry_date', v)}
                    required
                  />
                  <Field
                    label="新证照编号（可选）"
                    value={actionForm.new_license_no}
                    onChange={(v) => setActionField('new_license_no', v)}
                  />
                </div>
              )}
              {actionType === 'submit' && (
                <p>确定将此续期申请提交审核吗？</p>
              )}
              {actionType === 'start' && (
                <p>确定进入续期办理流程吗？</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="secondary-button" type="button" onClick={closeAction}>
                取消
              </button>
              <button className="primary-button" type="button" onClick={executeAction} disabled={processing}>
                <Clock size={16} />
                <span>{processing ? '处理中...' : '确认'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function actionTitle(type, licenseName) {
  const map = {
    submit: `提交审核 - ${licenseName}`,
    approve: `批准续期 - ${licenseName}`,
    reject: `拒绝续期 - ${licenseName}`,
    start: `开始续期流程 - ${licenseName}`,
    complete: `完成续期 - ${licenseName}`,
  }
  return map[type] || '操作'
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </label>
  )
}
