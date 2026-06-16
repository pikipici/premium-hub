"use client"

import { useEffect, useState } from 'react'

interface CountdownTimerProps {
  endsAt: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
}

function calcTimeLeft(endsAt: string): TimeLeft {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    expired: false,
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function CountdownTimer({ endsAt }: CountdownTimerProps) {
  const [time, setTime] = useState<TimeLeft>(() => calcTimeLeft(endsAt))

  useEffect(() => {
    const tick = () => setTime(calcTimeLeft(endsAt))
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  if (time.expired) {
    return (
      <span className="text-[11px] font-bold text-white/50 bg-white/10 px-2.5 py-1 rounded-full">
        Berakhir
      </span>
    )
  }

  const segments: { label: string; value: string }[] = [
    { label: 'h', value: pad(time.hours) },
    { label: 'm', value: pad(time.minutes) },
    { label: 's', value: pad(time.seconds) },
  ]

  if (time.days > 0) {
    segments.unshift({ label: 'd', value: pad(time.days) })
  }

  return (
    <div className="flex items-center gap-1 text-white">
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mr-1">
        Berakhir dalam
      </span>
      {segments.map((seg, i) => (
        <span key={i} className="flex items-center gap-0.5">
          <span className="bg-white/15 rounded-md px-1.5 py-0.5 text-xs font-mono font-bold tabular-nums">
            {seg.value}
          </span>
          <span className="text-[10px] text-white/50 font-medium">{seg.label}</span>
          {i < segments.length - 1 && <span className="text-white/20 mx-0.5">:</span>}
        </span>
      ))}
    </div>
  )
}
