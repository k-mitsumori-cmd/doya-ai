'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export interface Employee {
  id: string
  firstName: string
  lastName: string
  firstNameKana?: string | null
  lastNameKana?: string | null
  employeeNumber?: string | null
  email?: string | null
  phone?: string | null
  photoUrl?: string | null
  departmentId?: string | null
  department?: { id: string; name: string } | null
  position?: string | null
  grade?: string | null
  employmentType?: string | null
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'
  hireDate?: string | null
  createdAt?: string
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: '在籍', color: 'bg-emerald-100 text-emerald-700' },
  ON_LEAVE: { label: '休職中', color: 'bg-amber-100 text-amber-700' },
  RESIGNED: { label: '退職', color: 'bg-slate-100 text-slate-500' },
}

interface EmployeeCardProps {
  employee: Employee
}

export default function EmployeeCard({ employee }: EmployeeCardProps) {
  const status = STATUS_MAP[employee.status] ?? STATUS_MAP.ACTIVE
  const initials = `${employee.lastName?.[0] || ''}${employee.firstName?.[0] || ''}`

  return (
    <Link href={`/hr/employees/${employee.id}`}>
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 12px 24px -4px rgba(0,0,0,0.08)' }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center cursor-pointer hover:border-sky-300 transition-colors"
      >
        {/* Photo */}
        {employee.photoUrl ? (
          <img
            src={employee.photoUrl}
            alt={`${employee.lastName} ${employee.firstName}`}
            className="w-20 h-20 rounded-full object-cover border-2 border-slate-100 mb-4"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-white text-xl font-bold mb-4 border-2 border-sky-100">
            {initials}
          </div>
        )}

        {/* Name */}
        <h3 className="font-black text-slate-900 text-base">
          {employee.lastName} {employee.firstName}
        </h3>

        {/* Department + Position */}
        <p className="text-sm font-bold text-slate-600 mt-1">
          {employee.department?.name || '未所属'}
        </p>
        {employee.position && (
          <p className="text-sm font-semibold text-slate-500 mt-0.5">{employee.position}</p>
        )}

        {/* Status Badge */}
        <span className={`mt-3 px-3 py-1 rounded-full text-xs font-bold ${status.color}`}>
          {status.label}
        </span>
      </motion.div>
    </Link>
  )
}
