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
  RESIGNED: { label: '退職', color: 'bg-gray-100 text-gray-500' },
}

const AVATAR_COLORS = [
  'from-blue-400 to-blue-600',
  'from-red-400 to-red-600',
  'from-green-400 to-green-600',
  'from-amber-400 to-amber-600',
  'from-purple-400 to-purple-600',
  'from-pink-400 to-pink-600',
]

function formatHireDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}年${m}月入社`
}

interface EmployeeCardProps {
  employee: Employee
}

export default function EmployeeCard({ employee }: EmployeeCardProps) {
  const status = STATUS_MAP[employee.status] ?? STATUS_MAP.ACTIVE
  const initials = `${employee.lastName?.[0] || ''}${employee.firstName?.[0] || ''}`
  const colorIndex = ((employee.lastName?.charCodeAt(0) || 0) + (employee.firstName?.charCodeAt(0) || 0)) % AVATAR_COLORS.length

  return (
    <Link href={`/hr/employees/${employee.id}`}>
      <motion.div
        whileHover={{ y: -4, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)' }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-3xl shadow-md p-6 flex flex-col items-center text-center cursor-pointer transition-all"
      >
        {/* Photo */}
        {employee.photoUrl ? (
          <img
            src={employee.photoUrl}
            alt={`${employee.lastName} ${employee.firstName}`}
            className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm mb-4"
          />
        ) : (
          <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${AVATAR_COLORS[colorIndex]} flex items-center justify-center text-white text-xl font-bold mb-4 shadow-sm`}>
            {initials}
          </div>
        )}

        {/* Name */}
        <h3 className="font-black text-gray-900 text-base">
          {employee.lastName} {employee.firstName}
        </h3>

        {/* Hire Date */}
        {employee.hireDate && (
          <p className="text-xs font-semibold text-gray-500 mt-0.5">
            {formatHireDate(employee.hireDate)}
          </p>
        )}

        {/* Department + Position */}
        <p className="text-sm font-bold text-gray-600 mt-1">
          {employee.department?.name || '未所属'}
        </p>
        {employee.position && (
          <p className="text-sm font-semibold text-gray-500 mt-0.5">{employee.position}</p>
        )}

        {/* Status Badge */}
        <span className={`mt-3 px-4 py-1.5 rounded-full text-xs font-bold ${status.color}`}>
          {status.label}
        </span>
      </motion.div>
    </Link>
  )
}
