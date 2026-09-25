// ── Scheduler Module Types ────────────────────────────────────────

export type JobType = 'installation' | 'onsite' | 'hotline' | 'others' | 'leave' | 'absent'
export type JobStatus = 'pending' | 'ongoing' | 'success' | 'fail' | 'cancel'
export type StaffRole = 'manager' | 'bsm' | 'coordinator' | 'senior' | 'junior' | 'trainee'

export interface Branch {
  id: string
  name: string   // short code e.g. "CDO"
  note: string   // province/city
}

export interface Staff {
  id: string
  name: string
  role: StaffRole
  home_branch_id: string
  hotline?: boolean
}

export interface Job {
  id: string
  date: string           // YYYY-MM-DD
  staff_id: string
  branch_id: string
  type: JobType
  status: JobStatus
  jt_no?: string         // NetSuite job ticket number
  customer?: string
  status_note?: string
  type_other?: string
}

export interface SchedulerFilters {
  branch: string
  emp: string
  type: string
  status: string
}
