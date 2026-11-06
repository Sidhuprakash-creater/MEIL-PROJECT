'use client'
/**
 * Team Module — Site Team & Supervisors + Conversation panel.
 *
 * Roster is the MEIL seeded demo user set (real DB accounts, every one
 * flagged "Illustrative"). Per-role avatar tints mirror the app-shell. Chat
 * is fully local UI state (no backend wiring): pre-seeded threads + simulated
 * canned replies after 1s.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { MeilBoxLoader } from '@/components/shared/meil-loader'
import {
  Users, MessageSquare, Pencil, Trash2, Send, X, Circle, MoreVertical,
} from 'lucide-react'
import { toast } from 'sonner'

// ============================================================
// Types
// ============================================================
type RoleKey =
  | 'PROJECT_USER' | 'FINANCE_USER' | 'HR_USER' | 'EHS_USER' | 'PROCUREMENT_USER'
  | 'CSR_USER' | 'COMPLIANCE_USER' | 'ESG_ANALYST'

interface TeamMember {
  id: string
  name: string
  email: string
  roleKey: RoleKey
  roleLabel: string
  employeeCode: string
  active: boolean
  demo: true
}

interface ChatMessage {
  id: string
  fromMe: boolean
  text: string
  ts: string
}

// ============================================================
// Static demo data — mirrors prisma/seed.ts roster (all Illustrative)
// ============================================================
const ROLE_LABEL: Record<RoleKey, string> = {
  PROJECT_USER: 'Environment Data User',
  FINANCE_USER: 'Finance & Resource Data Contributor',
  HR_USER: 'HR User',
  EHS_USER: 'EHS / Safety User',
  PROCUREMENT_USER: 'Procurement / Supply Chain User',
  CSR_USER: 'CSR / Community User',
  COMPLIANCE_USER: 'Compliance / Governance User',
  ESG_ANALYST: 'ESG Analyst',
}

const ROLE_TINT: Record<RoleKey, string> = {
  PROJECT_USER: 'from-sky-500 to-blue-600',
  FINANCE_USER: 'from-blue-600 to-indigo-600',
  HR_USER: 'from-cyan-500 to-teal-600',
  EHS_USER: 'from-amber-500 to-orange-600',
  PROCUREMENT_USER: 'from-violet-500 to-purple-600',
  CSR_USER: 'from-rose-500 to-pink-600',
  COMPLIANCE_USER: 'from-emerald-500 to-green-600',
  ESG_ANALYST: 'from-emerald-500 to-teal-600',
}

const TEAM_MEMBERS: TeamMember[] = [
  { id: 'u2',  name: 'Rohit Kumar',        email: 'rohit@meil-esg.in',    roleKey: 'PROJECT_USER',     roleLabel: ROLE_LABEL.PROJECT_USER,     employeeCode: 'MEIL-PU-014',  active: true,  demo: true },
  { id: 'u3',  name: 'Sunita Rao',          email: 'sunita@meil-esg.in',  roleKey: 'HR_USER',          roleLabel: ROLE_LABEL.HR_USER,          employeeCode: 'MEIL-HR-022',  active: false, demo: true },
  { id: 'u4',  name: 'K. Venkat',          email: 'kvenkat@meil-esg.in',  roleKey: 'EHS_USER',         roleLabel: ROLE_LABEL.EHS_USER,         employeeCode: 'MEIL-EHS-009', active: true,  demo: true },
  { id: 'u5',  name: 'Priya Nair',          email: 'priya@meil-esg.in',   roleKey: 'PROCUREMENT_USER', roleLabel: ROLE_LABEL.PROCUREMENT_USER, employeeCode: 'MEIL-PRC-031', active: false, demo: true },
  { id: 'u6',  name: 'Imran Sheikh',        email: 'imran@meil-esg.in',   roleKey: 'CSR_USER',         roleLabel: ROLE_LABEL.CSR_USER,         employeeCode: 'MEIL-CSR-017', active: true,  demo: true },
  { id: 'u7',  name: 'Deepika Joshi',       email: 'deepika@meil-esg.in', roleKey: 'COMPLIANCE_USER',  roleLabel: ROLE_LABEL.COMPLIANCE_USER,  employeeCode: 'MEIL-GOV-005', active: false, demo: true },
  { id: 'u8',  name: 'Rahul Verma',         email: 'finance@meil-esg.in', roleKey: 'FINANCE_USER',     roleLabel: ROLE_LABEL.FINANCE_USER,     employeeCode: 'MEIL-FIN-001', active: true,  demo: true },
  { id: 'u12', name: 'Sameer Khan',        email: 'sameer@meil-esg.in',  roleKey: 'ESG_ANALYST',      roleLabel: ROLE_LABEL.ESG_ANALYST,      employeeCode: 'MEIL-ANA-001', active: true,  demo: true },
]

// Simulated canned replies (chat is local UI state only — no backend)
const CANNED_REPLIES: readonly string[] = [
  'Noted — I will review and revert shortly.',
  'Thanks for the heads-up! Pulling the latest figures now.',
  'Acknowledged. Logging this against the FY 2026-27 cycle.',
  'Sure — I will align with the ESG manager and confirm.',
  'Good catch. I have flagged it for the next review pass.',
  'On it. Will update the evidence pack before EOD.',
]

// ============================================================
// Helpers
// ============================================================
function initialsOf(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function nowTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function seedThread(member: TeamMember): ChatMessage[] {
  const today = new Date()
  const stamp = (h: number, m: number) => {
    const d = new Date(today)
    d.setHours(h, m, 0, 0)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return [
    { id: `${member.id}-s1`, fromMe: false, text: `Hi — sharing today's site snapshot for ${member.roleLabel.toLowerCase()} scope.`, ts: stamp(9, 12) },
    { id: `${member.id}-s2`, fromMe: true,  text: 'Thanks. Are the BRSR principle-wise entries locked for this period?', ts: stamp(9, 18) },
    { id: `${member.id}-s3`, fromMe: false, text: 'Two principles are pending evidence verification; the rest are locked.', ts: stamp(9, 24) },
  ]
}

// ============================================================
// Module
// ============================================================
export function TeamModule() {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({})
  const [draft, setDraft] = useState('')
  const [chatOpen, setChatOpen] = useState(true)
  const [sending, setSending] = useState(false)
  const threadRef = useRef<HTMLDivElement | null>(null)

  // Simulated fetch (local data) — preserves loading skeleton UX
  useEffect(() => {
    const t = setTimeout(() => {
      setMembers(TEAM_MEMBERS)
      const seed: Record<string, ChatMessage[]> = {}
      for (const m of TEAM_MEMBERS) seed[m.id] = seedThread(m)
      setThreads(seed)
      setActiveId(TEAM_MEMBERS[0].id)
      setLoading(false)
    }, 350)
    return () => clearTimeout(t)
  }, [])

  const activeMember = useMemo(
    () => members.find(m => m.id === activeId) ?? null,
    [members, activeId],
  )
  const activeThread = activeId ? threads[activeId] ?? [] : []

  // Auto-scroll thread to bottom on new messages / member switch
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeThread.length, activeId, threads])

  // ----- actions -----
  const onEdit = (m: TeamMember) => {
    toast.info(`Edit member — ${m.name}`, { description: `${m.roleLabel} · ${m.employeeCode} · Illustrative` })
  }

  const onDeleteRequest = (m: TeamMember) => {
    toast.warning(`Remove ${m.name} from team view?`, {
      description: 'Demo action — no DB records will be affected.',
      action: {
        label: 'Remove',
        onClick: () => {
          setMembers(prev => prev.filter(x => x.id !== m.id))
          setThreads(prev => {
            const next = { ...prev }
            delete next[m.id]
            return next
          })
          if (activeId === m.id) {
            const fallback = members.find(x => x.id !== m.id)
            if (fallback) setActiveId(fallback.id)
          }
          toast.success(`${m.name} removed from team view`)
        },
      },
    })
  }

  const openChat = (m: TeamMember) => {
    setActiveId(m.id)
    setChatOpen(true)
    requestAnimationFrame(() => {
      document.getElementById('team-chat-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    toast.message(`Conversation opened with ${m.name}`)
  }

  const sendMessage = () => {
    const text = draft.trim()
    if (!text || !activeMember) return
    const myMsg: ChatMessage = { id: `me-${Date.now()}`, fromMe: true, text, ts: nowTime() }
    setThreads(prev => ({ ...prev, [activeMember.id]: [...(prev[activeMember.id] ?? []), myMsg] }))
    setDraft('')
    setSending(true)
    // Simulated canned reply after 1s
    window.setTimeout(() => {
      const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)]
      const botMsg: ChatMessage = { id: `r-${Date.now()}`, fromMe: false, text: reply, ts: nowTime() }
      setThreads(prev => ({ ...prev, [activeMember.id]: [...(prev[activeMember.id] ?? []), botMsg] }))
      setSending(false)
    }, 1000)
  }

  const onDraftKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const closeChat = () => {
    setChatOpen(false)
    toast.info('Chat panel hidden', { description: 'Click any Message icon to reopen.' })
  }

  // ----- states -----
  if (loading) return <TeamSkeleton />
  if (members.length === 0) {
    return (
      <div className="so-glass rounded-2xl p-10 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-400" />
        <h3 className="mt-3 text-sm font-bold text-slate-700">No team members</h3>
        <p className="mt-1 text-xs text-slate-500">All seeded members have been removed from this view.</p>
      </div>
    )
  }

  // Framer-motion variants
  const gridContainer: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04 } },
  }
  const cardItem: Variants = {
    hidden: { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  }

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-blue-600/20">
              <Users className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-slate-800">Site Team &amp; Supervisors</h1>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {members.length} seeded members across {new Set(members.map(m => m.roleKey)).size} ESG / BRSR roles · all accounts marked Illustrative.
            <span className="ml-1 font-semibold text-emerald-600">{members.filter(m => m.active).length} active now</span>
          </p>
        </div>
        <button
          onClick={() => toast.info('Showing full team roster', { description: `${members.length} members · ${members.filter(m => m.active).length} active` })}
          className="btn-so-glass-primary inline-flex items-center gap-1.5 self-start rounded-full px-4 py-2 text-xs font-semibold shadow-md transition hover:brightness-105 sm:self-auto"
        >
          <Users className="h-3.5 w-3.5" /> View Team
        </button>
      </div>

      {/* Team grid */}
      <motion.div
        variants={gridContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {members.map(m => {
          const tint = ROLE_TINT[m.roleKey]
          const isActiveChat = activeId === m.id
          return (
            <motion.div key={m.id} variants={cardItem}>
              <TeamCard
                member={m}
                tint={tint}
                isActiveChat={isActiveChat}
                onEdit={() => onEdit(m)}
                onDelete={() => onDeleteRequest(m)}
                onChat={() => openChat(m)}
              />
            </motion.div>
          )
        })}
      </motion.div>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && activeMember && (
          <motion.div
            id="team-chat-panel"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="so-glass overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-200/40 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_TINT[activeMember.roleKey]} text-[11px] font-bold text-white shadow-md`}>
                  {initialsOf(activeMember.name)}
                  <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${activeMember.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-slate-800">
                    Conversation with {activeMember.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <span className="truncate">{activeMember.roleLabel}</span>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                      @{activeMember.email.split('@')[0]}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  title="Options"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/60 hover:text-slate-700"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <button
                  title="Close chat"
                  onClick={closeChat}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/60 hover:text-rose-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Message thread */}
            <div ref={threadRef} className="max-h-80 space-y-3 overflow-y-auto scroll-elegant px-4 py-4">
              <AnimatePresence initial={false}>
                {activeThread.map(msg => (
                  <MessageRow key={msg.id} msg={msg} member={activeMember} />
                ))}
              </AnimatePresence>
              {sending && (
                <div className="flex items-center gap-2 pl-8">
                  <span className="text-[10px] text-slate-400">{activeMember.name.split(' ')[0]} is typing</span>
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '240ms' }} />
                  </span>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 border-t border-slate-200/40 px-4 py-3">
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={onDraftKey}
                placeholder={`Message ${activeMember.name.split(' ')[0]}…`}
                className="so-glass-subtle min-w-0 flex-1 rounded-full px-4 py-2 text-xs text-slate-700 outline-none transition focus:ring-2 focus:ring-sky-200"
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim() || sending}
                title="Send message (Enter)"
                className="btn-so-glass-primary flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer caption */}
      <p className="px-1 text-[10px] text-slate-400">
        Team module shows the seeded MEIL demo roster (Illustrative accounts). Chat is local UI state — replies are simulated.
      </p>
    </section>
  )
}

// ============================================================
// Team Card
// ============================================================
interface TeamCardProps {
  member: TeamMember
  tint: string
  isActiveChat: boolean
  onEdit: () => void
  onDelete: () => void
  onChat: () => void
}

function TeamCard({ member, tint, isActiveChat, onEdit, onDelete, onChat }: TeamCardProps) {
  return (
    <div className={`group relative rounded-2xl p-3.5 transition ${isActiveChat ? 'so-glass-strong ring-2 ring-sky-200' : 'so-glass hover:shadow-lg'}`}>
      {/* Top-right edit / delete actions (reveal on hover) */}
      <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
        <button
          title="Edit member"
          onClick={onEdit}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/70 hover:text-sky-600"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          title="Remove member"
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Avatar + status dot */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-shrink-0">
          <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${tint} text-[12px] font-bold text-white shadow-md`}>
            {initialsOf(member.name)}
          </div>
          <span
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${member.active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
            title={member.active ? 'Active / Online' : 'Away'}
          />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <div className="truncate text-[13px] font-bold text-slate-800" title={member.name}>{member.name}</div>
          <div className="truncate text-[11px] text-slate-500" title={member.roleLabel}>{member.roleLabel}</div>
        </div>
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center justify-between gap-1">
        <span className={`status-pill ${member.active ? 'status-submitted' : 'status-locked'}`}>
          <Circle className="h-2 w-2" />
          {member.active ? 'Active' : 'Away'}
        </span>
        <span className="truncate text-[10px] text-slate-400" title={member.employeeCode}>{member.employeeCode}</span>
      </div>

      {/* Footer actions */}
      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          onClick={onChat}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${isActiveChat ? 'bg-sky-500 text-white shadow-sm' : 'bg-white/60 text-slate-600 hover:bg-white hover:text-sky-600'}`}
        >
          <MessageSquare className="h-3 w-3" /> Message
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/60 text-slate-500 transition hover:bg-white hover:text-sky-600 md:hidden"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Message Row
// ============================================================
interface MessageRowProps {
  msg: ChatMessage
  member: TeamMember
}

function MessageRow({ msg, member }: MessageRowProps) {
  const fromMe = msg.fromMe
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`flex items-end gap-2 ${fromMe ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {fromMe ? (
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-[9px] font-bold text-white">
          ME
        </div>
      ) : (
        <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${ROLE_TINT[member.roleKey]} text-[9px] font-bold text-white`}>
          {initialsOf(member.name)}
        </div>
      )}
      <div className={`max-w-[70%] ${fromMe ? 'text-right' : 'text-left'}`}>
        <div className={`so-glass-subtle inline-block rounded-2xl px-3 py-1.5 text-[12px] leading-snug ${fromMe ? 'bg-sky-50 text-slate-700' : 'text-slate-700'}`}>
          {msg.text}
        </div>
        <div className={`mt-0.5 text-[9px] text-slate-400 ${fromMe ? 'text-right' : 'text-left'}`}>{msg.ts}</div>
      </div>
    </motion.div>
  )
}

// ============================================================
// Loading Skeleton
// ============================================================
function TeamSkeleton() {
  return (
    <div className="so-glass rounded-2xl p-6">
      <MeilBoxLoader boxHeight="min-h-[420px]" label="Loading team…" />
    </div>
  )
}
