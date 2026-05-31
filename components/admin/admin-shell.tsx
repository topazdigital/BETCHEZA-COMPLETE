"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, Trophy, Calendar, Settings,
  Bell, LogOut, Menu, X, Shield, MessageSquare, Newspaper, Wallet, Mail,
  Rss, KeyRound, Star, CreditCard, Database, FileText, BarChart3, Wand2,
  UserPlus, Globe, MousePointerClick, Gem, TrendingUp, Megaphone, Activity,
  DoorOpen, ChevronDown, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderSearch } from "@/components/layout/header-search"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = {
  id: string
  label: string | null
  icon?: React.ElementType
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: null,
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    id: "people",
    label: "People",
    icon: Users,
    items: [
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/admin/tipsters", label: "Tipsters", icon: Trophy },
      { href: "/admin/tipster-applications", label: "Applications", icon: UserPlus },
    ],
  },
  {
    id: "tips",
    label: "Tips & Strategy",
    icon: TrendingUp,
    items: [
      { href: "/admin/predictions", label: "AI Predictions", icon: BarChart3 },
      { href: "/admin/auto-tips", label: "Auto-Tips", icon: Wand2 },
      { href: "/admin/strategy", label: "Daily Strategy", icon: TrendingUp },
      { href: "/admin/featured", label: "Featured Tips", icon: Star },
    ],
  },
  {
    id: "sports",
    label: "Sports Content",
    icon: Calendar,
    items: [
      { href: "/admin/matches", label: "Matches", icon: Calendar },
      { href: "/admin/jackpots", label: "Jackpots", icon: Gem },
      { href: "/admin/competitions", label: "Competitions", icon: Shield },
      { href: "/admin/news", label: "News", icon: Newspaper },
    ],
  },
  {
    id: "community",
    label: "Community",
    icon: Rss,
    items: [
      { href: "/admin/feed", label: "Feed", icon: Rss },
      { href: "/admin/rooms", label: "Rooms", icon: DoorOpen },
      { href: "/admin/comments", label: "Comments", icon: MessageSquare },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { href: "/admin/payments", label: "Payments", icon: Wallet },
      { href: "/admin/transactions", label: "Transactions", icon: BarChart3 },
      { href: "/admin/payment-gateways", label: "Gateways", icon: CreditCard },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { href: "/admin/bookmakers", label: "Bookmakers", icon: Globe },
      { href: "/admin/affiliate-clicks", label: "Affiliates", icon: MousePointerClick },
      { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/ads", label: "Ads", icon: Megaphone },
    ],
  },
  {
    id: "config",
    label: "Config",
    icon: Settings,
    items: [
      { href: "/admin/email-config", label: "Email Setup", icon: Mail },
      { href: "/admin/email-templates", label: "Email Templates", icon: FileText },
      { href: "/admin/social-login", label: "Social Login", icon: KeyRound },
      { href: "/admin/static-pages", label: "Static Pages", icon: FileText },
      { href: "/admin/database", label: "Database", icon: Database },
      { href: "/admin/api-status", label: "API Status", icon: Activity },
      { href: "/admin/settings", label: "Settings", icon: Settings },
    ],
  },
]

interface AdminShellProps {
  children: React.ReactNode
  user: { displayName: string; username: string; role: string }
}

function SidebarNav({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()

  // Auto-expand the group that contains the active route
  const activeGroupId = NAV_GROUPS.find(g =>
    g.items.some(item => item.href === pathname || (item.href !== "/admin" && pathname.startsWith(item.href)))
  )?.id ?? "overview"

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const g of NAV_GROUPS) {
      init[g.id] = g.label === null || g.id === activeGroupId
    }
    return init
  })

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
      {NAV_GROUPS.map((group) => {
        if (group.label === null) {
          return group.items.map(item => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })
        }

        const GroupIcon = group.icon!
        const isOpen = expanded[group.id]
        const hasActive = group.items.some(
          item => item.href === pathname || (item.href !== "/admin" && pathname.startsWith(item.href))
        )

        return (
          <div key={group.id}>
            <button
              onClick={() => toggle(group.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                hasActive
                  ? "text-primary bg-primary/8"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <GroupIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left truncate">{group.label}</span>
              {isOpen
                ? <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                : <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />
              }
            </button>

            {isOpen && (
              <div className="mt-0.5 ml-3 pl-2 border-l border-border space-y-0.5">
                {group.items.map(item => {
                  const Icon = item.icon
                  const isActive = item.href === pathname ||
                    (item.href !== "/admin" && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function AdminShell({ children, user }: AdminShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-56 transform flex-col border-r border-border bg-card transition-transform lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Shield className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold">Admin Panel</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <SidebarNav onClose={() => setSidebarOpen(false)} />

        <div className="border-t border-border p-2">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Back to Site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-56">
        <header className="sticky top-0 z-30 flex h-11 items-center gap-2 border-b border-border bg-card px-2 md:px-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden md:flex flex-1 max-w-md">
            <HeaderSearch inline placeholder="Search the site…" />
          </div>

          <div className="flex flex-1 md:flex-none items-center justify-end gap-1">
            <Button variant="ghost" size="icon" className="relative h-7 w-7">
              <Bell className="h-3.5 w-3.5" />
            </Button>
            <div className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block leading-tight max-w-[100px] truncate">
                <p className="text-[10px] font-semibold truncate">{user.displayName}</p>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" title="Sign out" className="ml-0.5 text-muted-foreground hover:text-destructive">
                  <LogOut className="h-3 w-3" />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="p-2 md:p-3">
          {children}
        </main>
      </div>
    </div>
  )
}
