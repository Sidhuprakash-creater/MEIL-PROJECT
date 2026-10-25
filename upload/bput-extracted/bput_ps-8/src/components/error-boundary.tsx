'use client'
import { Component, ReactNode } from 'react'

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error } }
  componentDidCatch(error: Error, info: any) { console.error('[ErrorBoundary]', this.props.label, error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center">
          <div className="text-base font-bold text-rose-600">Render error{this.props.label ? ` in ${this.props.label}` : ''}</div>
          <pre className="max-h-64 max-w-full overflow-auto scroll-elegant rounded-lg bg-rose-50 p-3 text-left text-[11px] text-rose-700">{this.state.error?.message ?? 'Unknown error'}{'\n'}{this.state.error?.stack}</pre>
          <button onClick={() => this.setState({ hasError: false, error: undefined })} className="btn-glass-primary rounded-full px-4 py-2 text-xs font-semibold">Retry</button>
        </div>
      )
    }
    return this.props.children
  }
}
