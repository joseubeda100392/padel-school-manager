'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [remember, setRemember] = useState(false)
  const supabase = createClient()

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Introduce tu email primero')
      return
    }
    setResetLoading(true)
    setError('')
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetSent(true)
    setResetLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
      return
    }

    const role = data.user?.user_metadata?.role
    window.location.href = role === 'student' ? '/student' : '/dashboard'
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden font-sans text-[#0b1c30]">
      {/* ── Background ── */}
      <div className="fixed inset-0 bg-gradient-to-tr from-[#003816] via-[#006b2c] to-[#00a849] z-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right,transparent 49.8%,rgba(255,255,255,0.08) 49.8%,rgba(255,255,255,0.08) 50.2%,transparent 50.2%),linear-gradient(to bottom,transparent 49.8%,rgba(255,255,255,0.08) 49.8%,rgba(255,255,255,0.08) 50.2%,transparent 50.2%)',
          }}
        />
        <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-[-5%] left-[-5%] w-[60%] h-[70%] border border-white/40 rounded-[2rem] rotate-12" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[60%] border border-white/40 rounded-[2rem] -rotate-6" />
          <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] border border-white/20 rounded-full" />
        </div>
      </div>
      <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-[#006b2c]/15 blur-[160px] rounded-full -translate-y-1/2 translate-x-1/3 z-0 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-[#006a61]/10 blur-[140px] rounded-full translate-y-1/2 -translate-x-1/4 z-0 pointer-events-none" />

      {/* ── Content ── */}
      <div className="relative z-10 min-h-screen flex items-center justify-center lg:justify-between px-4 md:px-8 lg:px-[8%] py-10">

        {/* Left hero — desktop only */}
        <div className="hidden lg:flex flex-col max-w-xl text-white">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2 bg-white/10 backdrop-blur-xl rounded-xl border border-white/20 shadow-xl">
              <svg className="w-11 h-11 text-[#7ffc97]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
              </svg>
            </div>
            <h1 className="text-[40px] font-extrabold tracking-tight leading-none">Padel Pro</h1>
          </div>
          <h2 className="text-[32px] font-extrabold tracking-tight leading-tight mb-4 max-w-lg">
            La plataforma inteligente para tu escuela de pádel
          </h2>
          <p className="text-[18px] font-medium opacity-80 mb-10 max-w-md leading-relaxed">
            Gestiona pistas, alumnos y entrenadores en un solo lugar con la tecnología líder en deportes de raqueta.
          </p>
          <div className="grid grid-cols-2 gap-6 max-w-md">
            <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <svg className="w-6 h-6 text-[#7ffc97] mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2z" />
              </svg>
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase opacity-60 mb-1">Control Total</p>
              <p className="text-[16px] font-medium">Panel en tiempo real</p>
            </div>
            <div className="bg-black/20 backdrop-blur-md p-4 rounded-2xl border border-white/10">
              <svg className="w-6 h-6 text-[#7ffc97] mb-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2.05v2.02c3.95.49 7 3.85 7 7.93 0 3.21-1.81 6-4.72 7.72L13 18v5h5l-1.22-1.22C19.91 19.07 22 15.76 22 12c0-5.18-3.95-9.45-9-9.95zM11 2.05C5.95 2.55 2 6.82 2 12c0 3.76 2.09 7.07 5.22 8.78L6 22h5V2.05z" />
              </svg>
              <p className="text-[10px] font-semibold tracking-[0.1em] uppercase opacity-60 mb-1">Reservas</p>
              <p className="text-[16px] font-medium">Automatización 24/7</p>
            </div>
          </div>
        </div>

        {/* ── Login Card ── */}
        <div
          className="w-full max-w-[460px] bg-white px-8 py-10 md:px-12 md:py-12 rounded-3xl"
          style={{ boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1),0 2px 4px -1px rgba(0,0,0,0.06),0 20px 40px -10px rgba(0,0,0,0.25),0 0 0 1px rgba(255,255,255,0.1) inset' }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10 text-center">
            <div className="p-4 bg-[#006b2c]/10 rounded-2xl mb-4">
              <svg className="w-14 h-14 text-[#006b2c]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7.05 13.406l3.534 3.536-1.413 1.414-1.06-1.063-1.062 1.063-1.413-1.415 1.06-1.06-1.056-1.057 1.41-1.418zm9.9-9.9l1.414 1.414-.354.354 1.413 1.413-1.06 1.06-1.413-1.41-.355.352-1.414-1.413zm-7.07.706a7 7 0 0 1 9.9 9.9l-9.9-9.9zm7.78 8.486l-1.413 1.415-4.244-4.244 1.413-1.414z" />
              </svg>
            </div>
            <h2 className="text-[24px] font-semibold tracking-tight text-[#0b1c30] mb-2">Padel School Manager</h2>
            <p className="text-[14px] text-[#3e4a3d]">La plataforma inteligente para tu escuela</p>
          </div>

          {/* Desktop header (login state) */}
          {!showReset && (
            <div className="hidden lg:block mb-10">
              <h3 className="text-3xl font-semibold tracking-tight text-[#0b1c30] mb-2">Bienvenido</h3>
              <p className="text-[14px] text-[#3e4a3d] leading-relaxed">Ingresa tus credenciales para continuar al panel de control.</p>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {!showReset && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email */}
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  placeholder=" "
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="peer w-full h-14 px-4 pt-6 pb-2 bg-white border border-[#bdcaba]/60 rounded-xl focus:outline-none focus:border-[#006b2c] transition-all text-[#0b1c30] placeholder-transparent"
                  onFocus={e => (e.target.style.boxShadow = '0 0 0 4px rgba(0,135,58,0.15)')}
                  onBlur={e => (e.target.style.boxShadow = '')}
                />
                <label
                  htmlFor="email"
                  className="absolute left-4 top-4 text-[#3e4a3d]/70 transition-all pointer-events-none origin-left text-base peer-focus:-translate-y-[1.65rem] peer-focus:scale-[0.8] peer-focus:text-[#00873a] peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-translate-y-[1.65rem] peer-[:not(:placeholder-shown)]:scale-[0.8]"
                >
                  Correo electrónico
                </label>
              </div>

              {/* Password */}
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  placeholder=" "
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="peer w-full h-14 px-4 pt-6 pb-2 bg-white border border-[#bdcaba]/60 rounded-xl focus:outline-none focus:border-[#006b2c] transition-all text-[#0b1c30] placeholder-transparent"
                  onFocus={e => (e.target.style.boxShadow = '0 0 0 4px rgba(0,135,58,0.15)')}
                  onBlur={e => (e.target.style.boxShadow = '')}
                />
                <label
                  htmlFor="password"
                  className="absolute left-4 top-4 text-[#3e4a3d]/70 transition-all pointer-events-none origin-left text-base peer-focus:-translate-y-[1.65rem] peer-focus:scale-[0.8] peer-focus:text-[#00873a] peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-translate-y-[1.65rem] peer-[:not(:placeholder-shown)]:scale-[0.8]"
                >
                  Contraseña
                </label>
              </div>

              {/* Remember me */}
              <div
                className="flex items-center gap-3 cursor-pointer group select-none"
                onClick={() => setRemember(!remember)}
              >
                <div
                  className="relative flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors shrink-0"
                  style={{
                    backgroundColor: remember ? '#006b2c' : undefined,
                    borderColor: remember ? '#006b2c' : '#bdcaba',
                  }}
                >
                  {remember && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-[14px] text-[#3e4a3d] group-hover:text-[#0b1c30] transition-colors">Recordarme</span>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[54px] bg-[#006b2c] hover:bg-[#005320] disabled:opacity-70 text-white font-medium rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 mt-2"
                style={{ boxShadow: '0 10px 15px -3px rgba(0,107,44,0.2)' }}
              >
                {loading ? (
                  <span className="inline-block w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : 'Iniciar Sesión'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setShowReset(true); setError('') }}
                  className="text-[#006b2c] font-medium hover:text-[#005320] underline decoration-[#006b2c]/30 underline-offset-8 transition-all text-[14px]"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </form>
          )}

          {/* ── RESET PASSWORD ── */}
          {showReset && (
            <div>
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => { setShowReset(false); setResetSent(false); setError('') }}
                  className="flex items-center gap-2 text-[#3e4a3d] hover:text-[#006b2c] transition-colors mb-6 group text-[12px] font-semibold tracking-widest uppercase"
                >
                  <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Volver al login
                </button>
                <h3 className="text-3xl font-semibold tracking-tight text-[#0b1c30] mb-2">Recuperar acceso</h3>
                <p className="text-[14px] text-[#3e4a3d] leading-relaxed">Te enviaremos un enlace para restablecer tu contraseña de forma segura.</p>
              </div>

              {resetSent ? (
                <div className="p-4 bg-[#86f2e4]/30 text-[#006a61] rounded-xl flex items-start gap-4 border border-[#006a61]/10">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <div>
                    <p className="font-medium text-[16px]">¡Correo enviado!</p>
                    <p className="text-[14px] opacity-80">Revisa tu bandeja de entrada en unos instantes.</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-6">
                  <div className="relative">
                    <input
                      id="reset-email"
                      type="email"
                      required
                      placeholder=" "
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="peer w-full h-14 px-4 pt-6 pb-2 bg-white border border-[#bdcaba]/60 rounded-xl focus:outline-none focus:border-[#006b2c] transition-all text-[#0b1c30] placeholder-transparent"
                      onFocus={e => (e.target.style.boxShadow = '0 0 0 4px rgba(0,135,58,0.15)')}
                      onBlur={e => (e.target.style.boxShadow = '')}
                    />
                    <label
                      htmlFor="reset-email"
                      className="absolute left-4 top-4 text-[#3e4a3d]/70 transition-all pointer-events-none origin-left text-base peer-focus:-translate-y-[1.65rem] peer-focus:scale-[0.8] peer-focus:text-[#00873a] peer-focus:font-semibold peer-[:not(:placeholder-shown)]:-translate-y-[1.65rem] peer-[:not(:placeholder-shown)]:scale-[0.8]"
                    >
                      Email de recuperación
                    </label>
                  </div>

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full h-[54px] bg-[#006b2c] hover:bg-[#005320] disabled:opacity-70 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-3"
                    style={{ boxShadow: '0 10px 15px -3px rgba(0,107,44,0.2)' }}
                  >
                    {resetLoading ? (
                      <span className="inline-block w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Enviar enlace'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-8 left-8 z-20 hidden md:block">
        <p className="text-white/40 text-[12px] font-semibold tracking-widest uppercase">© 2026 Padel Pro — Premium Sports Management</p>
      </footer>
    </main>
  )
}
