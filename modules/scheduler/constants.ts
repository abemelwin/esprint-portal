import type { Branch, Staff } from './types'

export const ROLES: Record<string, { label: string; short: string; color: string }> = {
  manager:     { label: 'Service Manager',        short: 'Svc Mgr',    color: '#4f46e5' },
  bsm:         { label: 'Branch Service Manager', short: 'Branch Mgr', color: '#9333ea' },
  coordinator: { label: 'Service Coordinator',    short: 'Coord',      color: '#0284c7' },
  senior:      { label: 'Senior FSE',             short: 'Senior',     color: '#2563eb' },
  junior:      { label: 'Junior FSE',             short: 'Junior',     color: '#059669' },
  trainee:     { label: 'Trainee',                short: 'Trainee',    color: '#d97706' },
}
export const ROLE_ORDER = ['manager', 'bsm', 'coordinator', 'senior', 'junior', 'trainee']

export const TYPES: Record<string, { label: string; cls: string; color: string }> = {
  installation: { label: 'Installation', cls: 't-install', color: '#4f46e5' },
  onsite:       { label: 'Onsite',       cls: 't-onsite',  color: '#2563eb' },
  hotline:      { label: 'Hotline',      cls: 't-hotline', color: '#ea580c' },
  others:       { label: 'Others',       cls: 't-others',  color: '#475569' },
  leave:        { label: 'Leave',        cls: 't-leave',   color: '#d97706' },
  absent:       { label: 'Absent',       cls: 't-absent',  color: '#ef4444' },
}
export const TYPE_KEYS = ['installation', 'onsite', 'hotline', 'others']

export const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending',        cls: 'pending' },
  ongoing: { label: 'Ongoing',        cls: 'ongoing' },
  success: { label: 'Successful',     cls: 'success' },
  fail:    { label: 'Not successful', cls: 'fail'    },
  cancel:  { label: 'Cancelled',      cls: 'cancel'  },
}

export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export const SEED_BRANCHES: Branch[] = [
  { id: 'b1',  name: 'BAC',    note: 'Negros Occidental' },
  { id: 'b2',  name: 'BUK',    note: 'Bukidnon' },
  { id: 'b3',  name: 'BUT',    note: 'Agusan del Norte' },
  { id: 'b4',  name: 'CAB',    note: 'Nueva Ecija' },
  { id: 'b5',  name: 'CAMSUR', note: 'Camarines Sur' },
  { id: 'b6',  name: 'CAV',    note: 'Cavite' },
  { id: 'b7',  name: 'CDO',    note: 'Misamis Oriental' },
  { id: 'b8',  name: 'CEB',    note: 'Cebu' },
  { id: 'b9',  name: 'DAV',    note: 'Davao del Sur' },
  { id: 'b10', name: 'GENSAN', note: 'South Cotabato' },
  { id: 'b11', name: 'ILO',    note: 'Iloilo' },
  { id: 'b12', name: 'ISA',    note: 'Isabela' },
  { id: 'b13', name: 'MAK',    note: 'Metro Manila' },
  { id: 'b14', name: 'PAG',    note: 'Zamboanga del Sur' },
  { id: 'b15', name: 'PAL',    note: 'Palawan' },
  { id: 'b16', name: 'PANG',   note: 'Pangasinan' },
  { id: 'b17', name: 'RIZ',    note: 'Rizal' },
  { id: 'b18', name: 'TAC',    note: 'Leyte' },
  { id: 'b19', name: 'TAG',    note: 'Davao del Norte' },
  { id: 'b20', name: 'ZAM',    note: 'Zamboanga del Sur' },
]

export const DESIGNATED_MANAGERS = [
  // Service Managers / Admins
  { nameKey: 'rioja',     fullName: 'Arnold Rioja',       role: 'manager',     label: '🌐 All Branches (Admin)' },
  { nameKey: 'danilo',    fullName: 'Danilo Carangan',    role: 'manager',     label: '🌐 All Branches (Admin)' },
  { nameKey: 'eina',      fullName: 'Ricky Eina',         role: 'manager',     label: '🏢 MAK · Makati' },
  { nameKey: 'de chavez', fullName: 'Limwel De Chavez',   role: 'manager',     label: '✏️ ISA, PANG, CAB, CAMSUR' },
  // Branch Service Managers
  { nameKey: 'almoite',   fullName: 'Michael Almoite',    role: 'bsm',         label: '🏢 PAL · Palawan' },
  { nameKey: 'coliflores',fullName: 'Darel Coliflores',   role: 'bsm',         label: '🏢 TAC · Tacloban' },
  { nameKey: 'calvo',     fullName: 'Jessriel Calvo',     role: 'bsm',         label: '🏢 CEB · Cebu' },
  { nameKey: 'sacuan',    fullName: 'Gerald Sacuan',      role: 'bsm',         label: '✏️ North Mindanao' },
  { nameKey: 'genabe',    fullName: 'Martin Genabe',      role: 'bsm',         label: '✏️ South Mindanao' },
  // Service Coordinators
  { nameKey: 'venus',     fullName: 'Venus Liloan',       role: 'coordinator', label: '🌐 All Branches (Coordinator)' },
  { nameKey: 'angelie',   fullName: 'Angelie Tamondong',  role: 'coordinator', label: '🌐 All Branches (Coordinator)' },
  { nameKey: 'arianne',   fullName: 'Arianne Espinosa',   role: 'coordinator', label: '🌐 All Branches (Coordinator)' },
  { nameKey: 'philip',    fullName: 'June Philip Garcia', role: 'coordinator', label: '🌐 All Branches (Coordinator)' },
  // Senior FSEs
  { nameKey: 'sioco',     fullName: 'John Trent Sioco',   role: 'senior',      label: '🌐 All Branches (Senior FSE)' },
  { nameKey: 'natan',     fullName: 'Dennis Natan',       role: 'senior',      label: '🌐 All Branches (Senior FSE)' },
  { nameKey: 'yumang',    fullName: 'Don Alexander Yumang',role: 'senior',     label: '🌐 All Branches (Senior FSE)' },
  { nameKey: 'templa',    fullName: 'Marvin Jay Templa',  role: 'senior',      label: '🌐 All Branches (Senior FSE)' },
]

export const SEED_STAFF: Staff[] = [
  { id: 's1',  name: 'Arnold Rioja',           role: 'manager',     home_branch_id: 'b13' },
  { id: 's2',  name: 'Ricky Eina',             role: 'manager',     home_branch_id: 'b13' },
  { id: 's3',  name: 'Limwel De Chavez',       role: 'manager',     home_branch_id: 'b12' },
  { id: 's4',  name: 'Jessriel Calvo',         role: 'bsm',         home_branch_id: 'b8'  },
  { id: 's5',  name: 'Gerald Sacuan',          role: 'bsm',         home_branch_id: 'b7'  },
  { id: 's6',  name: 'Martin Genabe',          role: 'bsm',         home_branch_id: 'b9'  },
  { id: 's7',  name: 'Venus Liloan',           role: 'coordinator', home_branch_id: 'b13' },
  { id: 's8',  name: 'Angelie Tamondong',      role: 'coordinator', home_branch_id: 'b13' },
  { id: 's9',  name: 'Arianne Espinosa',       role: 'coordinator', home_branch_id: 'b13' },
  { id: 's10', name: 'June Philip Garcia',     role: 'coordinator', home_branch_id: 'b13' },
  { id: 's11', name: 'Dennis Natan',           role: 'senior',      home_branch_id: 'b13', hotline: true },
  { id: 's12', name: 'Don Alexander Yumang',   role: 'senior',      home_branch_id: 'b13', hotline: true },
  { id: 's13', name: 'John Trent Sioco',       role: 'senior',      home_branch_id: 'b13', hotline: true },
  { id: 's14', name: 'Marvin Jay Templa',      role: 'senior',      home_branch_id: 'b13' },
  { id: 's15', name: 'Pedro Santos',           role: 'senior',      home_branch_id: 'b8'  },
  { id: 's16', name: 'Maria Garcia',           role: 'junior',      home_branch_id: 'b7'  },
  { id: 's17', name: 'Jose Reyes',             role: 'junior',      home_branch_id: 'b13' },
  { id: 's18', name: 'Ana Flores',             role: 'trainee',     home_branch_id: 'b9'  },
  { id: 's19', name: 'Carlo Bautista',         role: 'trainee',     home_branch_id: 'b13' },
]
