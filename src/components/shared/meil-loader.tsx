'use client'

/**
 * MEIL ESG — Orbit Loader
 *
 * A unique branded loading animation used across screens while data takes
 * load: a gradient progress arc plus counter-rotating orbit dots around a
 * breathing core, with a shimmering caption — pure framer-motion (no CSS
 * keyframes needed) so it scatters identically in every portal.
 *
 * Variants:
 *   <MeilLoader />                          inline block (cards / tables / screens)
 *   <MeilLoaderOverlay open label />        full-viewport overlay with backdrop
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'

const RING_GRADIENT = ['url(#meil-loader-grad)']

export function MeilLoader({
  size = 96,
  label = 'Loading data…',
  tone = 'dark',
  className = '',
}: {
  /** Rendered diameter of the orbit system in px. */
  size?: number
  /** Caption under the orbit. */
  label?: string
  /** 'dark' = for light glass screens, 'light' = on dark backdrops. */
  tone?: 'dark' | 'light'
  className?: string
}) {
  const textColor = tone === 'dark' ? 'text-slate-500' : 'text-slate-300'
  const barTone = tone === 'dark' ? 'bg-slate-200' : 'bg-white/15'
  const barShine = tone === 'dark' ? 'from-transparent via-blue-400 to-transparent' : 'from-transparent via-sky-300 to-transparent'

  return (
    <div className={`flex flex-col items-center justify-center gap-4 ${className}`} role="status" aria-live="polite">
      {/* ---- Orbit system ---- */}
      <div className="relative" style={{ width: size, height: size }}>
        {/* static track */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="meil-loader-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="55%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(100,116,139,0.14)" strokeWidth="2.5" />
          {/* rotating gradient arc (progress feel) */}
          <motion.g
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 1.6 }}
            style={{ originX: '50px', originY: '50px' }}
          >
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke={RING_GRADIENT[0]}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="68 221"
            />
          </motion.g>
          {/* inner dashed counter-orbit */}
          <motion.g
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 4.5 }}
            style={{ originX: '50px', originY: '50px' }}
          >
            <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(14,165,233,0.28)" strokeWidth="1.2" strokeDasharray="3 6" />
          </motion.g>
        </svg>

        {/* orbit dot A — fast, blue */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 1.6 }}
        >
          <span
            className="absolute rounded-full bg-blue-500 shadow-[0_0_12px_rgba(37,99,235,0.65)]"
            style={{ width: size * 0.09 + 3, height: size * 0.09 + 3, left: '50%', top: -size * 0.045 - 1, translate: '-50% -50%' }}
          />
        </motion.div>

        {/* orbit dot B — slow counter-rotation, emerald */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: -360 }}
          transition={{ repeat: Infinity, ease: 'linear', duration: 2.8 }}
        >
          <span
            className="absolute rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
            style={{ width: size * 0.075 + 2, height: size * 0.075 + 2, left: '50%', bottom: -size * 0.0375, translate: '-50% 50%' }}
          />
        </motion.div>

        {/* breathing core */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.09, 1], opacity: [0.92, 1, 0.92] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
        >
          <span
            className="flex items-center justify-center rounded-full font-black text-white"
            style={{
              width: size * 0.42,
              height: size * 0.42,
              fontSize: Math.max(size * 0.16, 10),
              letterSpacing: '0.05em',
              background: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 55%, #0E7490 100%)',
              boxShadow: '0 4px 18px rgba(15,23,42,0.35), inset 0 1px 2px rgba(255,255,255,0.25)',
            }}
          >
            ME
          </span>
        </motion.div>
      </div>

      {/* ---- Caption + shimmer bar ---- */}
      <div className="flex flex-col items-center gap-2">
        {label ? (
          <motion.span
            className={`text-[11px] font-bold tracking-wide uppercase ${textColor}`}
            animate={{ opacity: [0.55, 1, 0.55] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          >
            {label}
          </motion.span>
        ) : null}
        <div className={`h-1 w-36 overflow-hidden rounded-full ${barTone}`}>
          <motion.div
            className={`h-full w-1/2 rounded-full bg-gradient-to-r ${barShine}`}
            animate={{ x: ['-100%', '180%'] }}
            transition={{ repeat: Infinity, ease: 'easeInOut', duration: 1.15 }}
          />
        </div>
      </div>
    </div>
  )
}

/** Full-viewport overlay loader — locks body scroll while open. */
export function MeilLoaderOverlay({
  open,
  label = 'Preparing your data…',
  through = false,
}: {
  open: boolean
  label?: string
  /** 'through' = click-through backdrop (for soft refreshes); default blocks. */
  through?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className={`fixed inset-0 z-[120] flex items-center justify-center ${through ? '' : 'bg-slate-950/45'} backdrop-blur-md`}
        >
          <MeilLoader size={110} label={label} tone="light" />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/** Light inline loader card used inside table bodies / card grids. */
export function MeilBoxLoader({
  boxHeight = 'min-h-[240px]',
  label = 'Loading data…',
}: {
  boxHeight?: string
  label?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className={`flex w-full items-center justify-center ${boxHeight}`}
    >
      <MeilLoader size={72} label={label} />
    </motion.div>
  )
}
