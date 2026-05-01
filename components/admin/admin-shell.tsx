"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, Users, Trophy, Calendar, Settings, 
  Bell, LogOut, Menu, X, Shield, MessageSquare, Newspaper, Wallet, Mail, Rss, KeyRound, Star, CreditCard, Database, FileText, BarChart3, Wand2, UserPlus, Globe, MousePointerClick,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeaderSearch } from "@/components/layout/header-search"
import { cn } from "@/lib/utils"

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/tipsters", label: "Tipsters", icon: Trophy },
  { href: "/admin/tipster-applications", label: "Applications", icon: UserPlus },
  { href: "/admin/bookmakers", label: "Bookmakers", icon: Globe },
  { href: "/admin/affiliate-clicks", label: "Affiliate Clicks", icon: MousePointerClick },
  { href: "/admin/matches", label: "Matches", icon: Calendar },
  { href: "/admin/predictions", label: "Predictions", icon: BarChart3 },
  { href: "/admin/auto-tips", label: "Auto-Tip Generator", icon: Wand2 },
  { href: "/admin/competitions", label: "Competitions", icon: Shield },
  { href: "/admin/comments", label: "Comments", icon: MessageSquare },
  { href: "/admin/feed", label: "Community Feed", icon: Rss },
  { href: "/admin/news", label: "News", icon: Newspaper },
  { href: "/admin/payments", label: "Payments", icon: Wallet },
  { href: "/admin/transactions", label: "Transactions", icon: BarChart3 },
  { href: "/admin/payment-gateways", label: "Gateways", icon: CreditCard },
  { href: "/admin/subscribers", label: "Subscribers", icon: Mail },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/featured", label: "Featured Tips", icon: Star },
  { href: "/admin/email-config", label: "Email Setup", icon: Mail },
  { href: "/admin/email-templates", label: "Email Templates", icon: Mail },
  { href: "/admin/social-login", label: "Social Login", icon: KeyRound },
  { href: "/admin/database", label: "Database", icon: Database },
  { href: "/admin/static-pages", label: "Static Pages", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

interface AdminShellProps {
  children: React.ReactNode
  user: { displayName: string; username: string; role: string }
}

export function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — narrower & denser */}
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

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </nav>

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

      {/* Main Content */}
      <div className="lg:pl-56">
        {/* Top Header — slimmer */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-card px-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex-1 max-w-md">
            <HeaderSearch inline placeholder="Search the site (matches, teams, tipsters)…" />
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block leading-tight">
                <p className="text-[11px] font-semibold">{user.displayName}</p>
                <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{user.role}</p>
              </div>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" title="Sign out" className="ml-0.5 text-muted-foreground hover:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Page Content — denser default padding */}
        <main className="p-3 md:p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
