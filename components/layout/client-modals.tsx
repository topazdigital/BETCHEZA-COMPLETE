"use client"

import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/auth/auth-modal').then(m => ({ default: m.AuthModal })), { ssr: false })
const GoogleOneTap = dynamic(() => import('@/components/auth/google-one-tap').then(m => ({ default: m.GoogleOneTap })), { ssr: false })
const AIChatButton = dynamic(() => import('@/components/ai/ai-chat-button').then(m => ({ default: m.AIChatButton })), { ssr: false })
const InstallPrompt = dynamic(() => import('@/components/install-prompt').then(m => ({ default: m.InstallPrompt })), { ssr: false })
const BetSlipPanel = dynamic(() => import('@/components/bet-slip/bet-slip-panel').then(m => ({ default: m.BetSlipPanel })), { ssr: false })

export function ClientModals() {
  return (
    <>
      <AuthModal />
      <GoogleOneTap />
      <AIChatButton />
      <InstallPrompt />
      <BetSlipPanel />
    </>
  )
}
