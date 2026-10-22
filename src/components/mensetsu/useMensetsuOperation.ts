'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
type CurrentScope = { current: () => boolean }
type Ticket = { proof: CurrentScope; id: number }

/** A legacy writer has no durable operation ID. Losing its response must fence a repeat write. */
export function useMensetsuOperation(proof: CurrentScope | null) {
  const owner = useRef(proof)
  const serial = useRef(0)
  const pending = useRef(new Set<number>())
  const [unknown, setUnknown] = useState(false)

  useEffect(() => {
    if (owner.current === proof) return
    if (pending.current.size > 0) setUnknown(true)
    owner.current = proof
    serial.current++
    pending.current.clear()
  }, [proof])

  const begin = useCallback((): Ticket | null => {
    if (!proof?.current() || owner.current !== proof || unknown || pending.current.size > 0) return null
    const id = ++serial.current
    pending.current.add(id)
    return { proof, id }
  }, [proof, unknown])
  const current = useCallback((ticket: Ticket | null) => !!ticket && owner.current === ticket.proof &&
    serial.current === ticket.id && pending.current.has(ticket.id) && ticket.proof.current(), [])
  const uncertain = useCallback((ticket: Ticket | null) => {
    if (ticket && owner.current === ticket.proof && pending.current.has(ticket.id)) setUnknown(true)
  }, [])
  const finish = useCallback((ticket: Ticket | null) => {
    if (!ticket || !pending.current.has(ticket.id)) return
    if (!ticket.proof.current() || owner.current !== ticket.proof) setUnknown(true)
    pending.current.delete(ticket.id)
  }, [])

  return { begin, current, uncertain, finish, unknown }
}
