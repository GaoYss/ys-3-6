export const licenseTypes = [
  { value: 'business', label: '营业执照' },
  { value: 'permit', label: '经营许可' },
  { value: 'qualification', label: '资质证书' },
  { value: 'tax', label: '税务证照' },
  { value: 'other', label: '其他' },
]

export const licenseStatuses = [
  { value: 'active', label: '有效' },
  { value: 'expiring', label: '即将到期' },
  { value: 'expired', label: '已到期' },
  { value: 'archived', label: '已归档' },
]

export const borrowStatuses = [
  { value: 'borrowed', label: '借出中' },
  { value: 'returned', label: '已归还' },
  { value: 'overdue', label: '逾期未还' },
]

export const renewalStatuses = [
  { value: 'pending', label: '待提交' },
  { value: 'reviewing', label: '审核中' },
  { value: 'approved', label: '已批准' },
  { value: 'in_progress', label: '续期中' },
  { value: 'completed', label: '已完成' },
  { value: 'rejected', label: '已拒绝' },
]
