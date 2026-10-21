'use client'

import { useCallback } from 'react'
import { useMensetsuProof } from './MensetsuWorkspaceBoundary'
import { requestMensetsuStaff } from '@/lib/mensetsu/staff-request-client'

/** Capture the proved actor and organization before any staff request begins. */
export function useMensetsuRequest() {
  const proof = useMensetsuProof()
  const request = useCallback((path: string, init?: RequestInit) => requestMensetsuStaff(proof, path, init), [proof])
  return { proof, request }
}
