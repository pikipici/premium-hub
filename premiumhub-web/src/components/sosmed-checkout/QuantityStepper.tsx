'use client'

import { Minus, Plus } from 'lucide-react'

interface QuantityStepperProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  presets?: number[]
  unit?: string
  label?: string
  helper?: string
}

export function QuantityStepper({
  value,
  min = 1,
  max = 1000,
  onChange,
  presets = [1, 5, 10],
  unit = 'K',
  label = 'Jumlah Paket 1K',
  helper = '1 paket = 1.000 Followers. Contoh: 5 paket = sekitar 5.000 Followers.',
}: QuantityStepperProps) {
  const clamped = (v: number) => Math.min(max, Math.max(min, Math.floor(v)))

  const handleDecrement = () => onChange(clamped(value - 1))
  const handleIncrement = () => onChange(clamped(value + 1))
  const handleInput = (raw: string) => {
    const num = Number(raw)
    if (raw === '' || Number.isNaN(num)) {
      onChange(min)
      return
    }
    onChange(clamped(num))
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#666]">{label}</label>

      <div className="flex overflow-hidden rounded-xl border border-[#E5E5E5] bg-white">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={value <= min}
          className="flex w-11 items-center justify-center bg-[#F7F7F5] text-[#666] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>

        <input
          value={value}
          onChange={(e) => handleInput(e.target.value)}
          type="number"
          min={min}
          max={max}
          className="w-full px-2 py-2.5 text-center text-sm font-bold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <button
          type="button"
          onClick={handleIncrement}
          disabled={value >= max}
          className="flex w-11 items-center justify-center bg-[#F7F7F5] text-[#666] transition-colors hover:bg-[#EBEBEB] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>

        <div className="flex min-w-16 items-center justify-center border-l border-[#E5E5E5] bg-[#FAFAF8] px-3 text-xs font-bold text-[#666]">
          x {unit}
        </div>
      </div>

      {helper && <p className="mt-1 text-xs text-[#888]">{helper}</p>}

      {presets.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 sm:flex sm:gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(clamped(preset))}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
                value === preset
                  ? 'border-[#141414] bg-[#141414] text-white'
                  : 'border-[#E5E5E5] bg-white text-[#666] hover:border-[#141414]'
              }`}
            >
              {preset.toLocaleString('id-ID')}
              {unit}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
