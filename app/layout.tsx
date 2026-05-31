import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { headers } from 'next/headers'
// Analytics removed — not needed for self-hosted deployments
import { ThemeProvider } from '@/components/theme-provider'
import { UserSettingsProvider } from '@/contexts/user-settings-context'
import { AuthProvider } from '@/contexts/auth-context'
import { AuthModalProvider } from '@/contexts/auth-modal-context'
import { BetSlipProvider } from '@/contexts/bet-slip-context'
import { ClientModals } from '@/components/layout/client-modals'
import { getSiteSettings, parseSeoPages, findSeoForPath } from '@/lib/site-settings'
import { Toaster } from 'sonner'
import { NavigationProgress } from '@/components/layout/navigation-progress'
import { ServiceWorkerRegister } from '@/components/layout/service-worker-register'
import { ClarityAnalytics } from '@/components/layout/clarity-analytics'
import './globals.css'

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
  display: 'swap',
  preload: true,
});

// Module-level constant — built once at startup, not on every request
const DEFAULT_KEYWORDS = [
  // ── Brand ──────────────────────────────────────────────────────────────
  'Betcheza', 'betcheza.co.ke', 'Betcheza tips', 'Betcheza predictions',
  'Betcheza Kenya', 'Betcheza jackpot', 'Betcheza AI predictor',
  'Betcheza free tips', 'Betcheza betting community', 'Betcheza strategy',

  // ── Primary target keywords ─────────────────────────────────────────────
  'best betting tips in Kenya', 'best betting tips Kenya',
  'best football tips in Kenya', 'best football predictions in Kenya',
  'best prediction site Kenya', 'best sports prediction site Kenya',
  'best tipster site Kenya', 'best sports betting site Kenya',
  'top betting tips Kenya', 'top prediction site Kenya',
  'number 1 betting tips Kenya', '#1 betting tips Kenya',
  'most accurate betting tips Kenya', 'most trusted betting tips Kenya',
  'most trusted prediction site Kenya', 'most reliable tips Kenya',
  'winning tips Kenya', 'winning football predictions Kenya',
  'high accuracy tips Kenya', '90 percent accuracy prediction Kenya',
  'prediction site with highest accuracy Kenya',
  'which prediction site has 90 accuracy Kenya',
  'which is the best prediction site in Kenya',
  'which AI is best for football prediction',
  'best AI football predictor Kenya', 'AI football prediction site Kenya',
  'what is the most trusted betting tips site',
  'what is the best strategy to win betting',
  'how to win sports betting Kenya',

  // ── SportPesa ───────────────────────────────────────────────────────────
  'SportPesa', 'SportPesa tips', 'SportPesa predictions',
  'SportPesa mega jackpot', 'SportPesa mega jackpot predictions',
  'SportPesa mega jackpot tips this week', 'SportPesa jackpot this week',
  'SportPesa midweek jackpot', 'SportPesa midweek jackpot tips',
  'SportPesa midweek jackpot predictions', 'SportPesa jackpot banker',
  'SportPesa jackpot results', 'SportPesa jackpot analysis',
  'SportPesa tips today', 'SportPesa free tips', 'win SportPesa jackpot',
  'SportPesa jackpot 13/13', 'SportPesa jackpot winners',
  'SportPesa jackpot bonus', 'SportPesa tips free today',
  'SportPesa sure tips', 'SportPesa winning picks',

  // ── Betika ──────────────────────────────────────────────────────────────
  'Betika', 'Betika tips', 'Betika tips today', 'Betika predictions',
  'Betika grand jackpot', 'Betika grand jackpot tips',
  'Betika grand jackpot predictions', 'Betika jackpot analysis',
  'Betika jackpot banker today', 'Betika midweek jackpot tips',
  'Betika free tips', 'Betika winning tips', 'Betika jackpot results',
  'how to win Betika jackpot', 'Betika jackpot 17/17',
  'Betika sure tips', 'Betika jackpot bonus', 'Betika sure wins',

  // ── Odibets ─────────────────────────────────────────────────────────────
  'Odibets', 'Odibets tips', 'Odibets tips today', 'Odibets predictions',
  'Odibets jackpot tips', 'Odibets free tips', 'Odibets winning tips',
  'Odibets jackpot predictions', 'Odibets jackpot banker',
  'Odibets sure tips', 'Odibets accumulator tips',

  // ── Kenya betting site (general) ────────────────────────────────────────
  'Kenya betting site',

  // ── Bahatibet ────────────────────────────────────────────────────────────
  'Bahatibet', 'Bahatibet Kenya', 'Bahatibet tips', 'Bahatibet tips today',
  'Bahatibet predictions', 'Bahatibet free tips', 'Bahatibet jackpot',
  'Bahatibet jackpot tips', 'Bahatibet jackpot predictions',
  'Bahatibet jackpot banker', 'Bahatibet winning tips',
  'how to win Bahatibet jackpot', 'Bahatibet jackpot today',
  'Bahatibet sure tips', 'Bahatibet analysis', 'best Bahatibet tips',
  'free Bahatibet predictions', 'Bahatibet football tips',
  'Bahatibet accumulator tips', 'Bahatibet odds Kenya',
  'Bahatibet sign up bonus', 'Bahatibet welcome offer',

  // ── Wazabet ──────────────────────────────────────────────────────────────
  'Wazabet', 'Wazabet Kenya', 'Wazabet tips', 'Wazabet tips today',
  'Wazabet predictions', 'Wazabet free tips', 'Wazabet jackpot tips',
  'Wazabet winning tips', 'Wazabet sure tips', 'best Wazabet tips',
  'Wazabet football tips', 'Wazabet accumulator tips',
  'Wazabet jackpot', 'Wazabet jackpot predictions', 'Wazabet free bets',

  // ── Sportybet ────────────────────────────────────────────────────────────
  'Sportybet', 'Sportybet Kenya', 'Sportybet tips', 'Sportybet tips today',
  'Sportybet predictions', 'Sportybet free tips', 'Sportybet jackpot',
  'Sportybet jackpot tips', 'Sportybet jackpot predictions',
  'Sportybet sure tips', 'best Sportybet tips', 'Sportybet football tips',
  'Sportybet jackpot banker', 'Sportybet winning tips',

  // ── Betika24 ─────────────────────────────────────────────────────────────
  'Betika24', 'Betika24 Kenya', 'Betika24 tips', 'Betika24 predictions',
  'Betika24 jackpot tips', 'Betika24 free tips', 'Betika24 jackpot banker',
  'Betika24 winning tips', 'Betika24 sure tips',

  // ── BetLion ──────────────────────────────────────────────────────────────
  'Betlion', 'BetLion', 'Betlion Kenya', 'Betlion tips', 'Betlion predictions',
  'Betlion jackpot', 'BetLion jackpot tips', 'BetLion super jackpot',
  'BetLion jackpot banker', 'BetLion winning tips', 'BetLion free tips',
  'best BetLion tips', 'BetLion sure tips', 'BetLion jackpot today',

  // ── Betpawa ──────────────────────────────────────────────────────────────
  'Betpawa', 'Betpawa Kenya', 'Betpawa tips', 'Betpawa tips today',
  'Betpawa predictions', 'Betpawa free tips', 'Betpawa jackpot tips',
  'Betpawa winning tips', 'Betpawa sure tips', 'Betpawa free bets',
  'how to win Betpawa jackpot', 'best Betpawa tips',

  // ── Melbet ───────────────────────────────────────────────────────────────
  'Melbet Kenya', 'Melbet tips', 'Melbet tips today', 'Melbet predictions',
  'Melbet free tips', 'Melbet jackpot tips', 'Melbet sure tips',
  'Melbet winning tips', 'best Melbet tips', 'Melbet free bets Kenya',

  // ── Betway Kenya ──────────────────────────────────────────────────────────
  'Betway Kenya', 'Betway Kenya tips', 'Betway Kenya predictions',
  'Betway tips today Kenya', 'Betway free tips Kenya',
  'Betway jackpot Kenya', 'Betway Kenya free bets',
  'Betway Kenya sure tips', 'Betway accumulator tips Kenya',
  'Betway Kenya jackpot banker', 'how to win Betway jackpot Kenya',

  // ── Mozzartbet ────────────────────────────────────────────────────────────
  'Mozzartbet Kenya', 'Mozzartbet tips', 'Mozzartbet predictions',
  'Mozzartbet jackpot tips', 'Mozzartbet tips today',
  'Mozzartbet jackpot banker', 'Mozzartbet free tips',
  'Mozzartbet sure tips', 'best Mozzartbet tips',

  // ── 1xBet ─────────────────────────────────────────────────────────────────
  '1xBet Kenya', '1xBet Kenya tips', '1xBet Kenya predictions',
  '1xBet free tips Kenya', '1xBet jackpot tips Kenya',
  '1xBet sure tips Kenya', '1xBet winning tips Kenya',
  '1xBet accumulator tips Kenya', '1xBet jackpot banker Kenya',

  // ── Elitebet ──────────────────────────────────────────────────────────────
  'Elitebet Kenya', 'Elitebet tips', 'Elitebet jackpot tips',
  'Elitebet tips today', 'Elitebet predictions', 'Elitebet free tips',
  'Elitebet jackpot banker', 'Elitebet winning tips', 'best Elitebet tips',
  'Elitebet jackpot today', 'Elitebet sure tips',

  // ── Helabet ───────────────────────────────────────────────────────────────
  'Helabet Kenya', 'Helabet tips', 'Helabet predictions',
  'Helabet jackpot tips', 'Helabet tips today', 'Helabet free tips',
  'Helabet winning tips', 'Helabet sure tips', 'best Helabet tips',

  // ── Dafabet ───────────────────────────────────────────────────────────────
  'Dafabet Kenya', 'Dafabet tips', 'Dafabet predictions',
  'Dafabet tips today', 'Dafabet free tips', 'Dafabet sure tips',

  // ── Parimatch ─────────────────────────────────────────────────────────────
  'Parimatch Kenya', 'Parimatch tips', 'Parimatch predictions',
  'Parimatch tips today', 'Parimatch free tips', 'Parimatch jackpot tips',
  'Parimatch sure tips', 'best Parimatch tips',

  // ── 22bet ─────────────────────────────────────────────────────────────────
  '22bet Kenya', '22bet tips Kenya', '22bet predictions Kenya',
  '22bet tips today', '22bet free tips', '22bet jackpot tips',
  '22bet sure tips', 'best 22bet tips Kenya',

  // ── Msport ────────────────────────────────────────────────────────────────
  'Msport Kenya', 'Msport tips', 'Msport predictions',
  'Msport tips today', 'Msport free tips', 'Msport jackpot tips',
  'Msport sure tips', 'Msport jackpot banker',

  // ── Bangbet ───────────────────────────────────────────────────────────────
  'Bangbet Kenya', 'Bangbet tips', 'Bangbet predictions',
  'Bangbet tips today', 'Bangbet free tips', 'Bangbet jackpot tips',
  'Bangbet sure tips', 'best Bangbet tips',

  // ── Betin ─────────────────────────────────────────────────────────────────
  'Betin Kenya', 'Betin tips', 'Betin predictions',
  'Betin jackpot tips', 'Betin tips today', 'Betin free tips',
  'Betin winning tips', 'Betin sure tips',

  // ── Premiertabet ──────────────────────────────────────────────────────────
  'Premiertabet Kenya', 'Premiertabet tips', 'Premiertabet predictions',
  'Premiertabet jackpot tips', 'Premiertabet free tips', 'Premiertabet sure tips',

  // ── Shabiki ───────────────────────────────────────────────────────────────
  'Shabiki Kenya', 'Shabiki tips', 'Shabiki jackpot tips', 'Shabiki predictions',
  'Shabiki jackpot banker', 'Shabiki jackpot today', 'Shabiki free tips',
  'Shabiki winning tips', 'how to win Shabiki jackpot',

  // ── Betyetu ───────────────────────────────────────────────────────────────
  'Betyetu Kenya', 'Betyetu tips', 'Betyetu predictions',
  'Betyetu jackpot tips', 'Betyetu tips today', 'Betyetu free tips',
  'Betyetu winning tips', 'Betyetu jackpot banker', 'best Betyetu tips',

  // ── Chezacash ─────────────────────────────────────────────────────────────
  'Chezacash Kenya', 'Chezacash tips', 'Chezacash predictions',
  'Chezacash jackpot tips', 'Chezacash tips today', 'Chezacash free tips',
  'Chezacash winning tips', 'Chezacash jackpot banker',

  // ── Kwikbet ───────────────────────────────────────────────────────────────
  'Kwikbet Kenya', 'Kwikbet tips', 'Kwikbet predictions',
  'Kwikbet jackpot tips', 'Kwikbet free tips', 'Kwikbet sure tips',
  'Kwikbet jackpot banker', 'Kwikbet winning tips',

  // ── Betspot ───────────────────────────────────────────────────────────────
  'Betspot Kenya', 'Betspot tips', 'Betspot predictions',
  'Betspot jackpot tips', 'Betspot free tips', 'Betspot sure tips',

  // ── Supa Bets ─────────────────────────────────────────────────────────────
  'Supa Bets Kenya', 'Supabets Kenya', 'Supabets tips Kenya',
  'Supabets predictions Kenya', 'Supabets jackpot tips', 'Supa Bets tips',
  'Supabets free tips', 'Supabets winning tips',

  // ── Palmbet ───────────────────────────────────────────────────────────────
  'Palmbet Kenya', 'Palmbet tips', 'Palmbet predictions',
  'Palmbet jackpot tips', 'Palmbet free tips', 'Palmbet sure tips',

  // ── Longbet ───────────────────────────────────────────────────────────────
  'Longbet Kenya', 'Longbet tips', 'Longbet predictions',
  'Longbet jackpot tips', 'Longbet free tips', 'Longbet sure tips',

  // ── McBet ─────────────────────────────────────────────────────────────────
  'McBet Kenya', 'McBet tips', 'McBet predictions',
  'McBet jackpot tips', 'McBet free tips', 'McBet sure tips',
  'McBet jackpot banker', 'McBet winning tips',

  // ── Meridianbet ───────────────────────────────────────────────────────────
  'Meridianbet Kenya', 'Meridianbet tips', 'Meridianbet predictions',
  'Meridianbet jackpot tips', 'Meridianbet free tips', 'Meridianbet sure tips',

  // ── Tembobet ──────────────────────────────────────────────────────────────
  'Tembobet Kenya', 'Tembobet tips', 'Tembobet predictions',
  'Tembo Bet Kenya', 'Tembo Bet tips', 'Tembo Bet free tips',

  // ── Bamboo Bet ────────────────────────────────────────────────────────────
  'Bamboo Bet Kenya', 'Bamboo Bet tips', 'Bamboo Bet predictions',
  'BambooBet Kenya', 'BambooBet tips', 'BambooBet free tips',

  // ── JBL Bet ───────────────────────────────────────────────────────────────
  'JBL Bet Kenya', 'JBL Bet tips', 'JBL Bet predictions', 'JBL Bet free tips',

  // ── Bet254 ────────────────────────────────────────────────────────────────
  'Bet254 Kenya', 'Bet254 tips', 'Bet254 predictions',
  'Bet254 jackpot tips', 'Bet254 free tips', 'Bet254 sure tips',

  // ── Betland ───────────────────────────────────────────────────────────────
  'Betland Kenya', 'Betland tips', 'Betland predictions',
  'Betland jackpot tips', 'Betland free tips', 'Betland sure tips',

  // ── Pesabet ───────────────────────────────────────────────────────────────
  'Pesabet Kenya', 'Pesabet tips', 'Pesabet predictions',
  'Pesabet jackpot tips', 'Pesabet free tips',

  // ── Kengenbet ─────────────────────────────────────────────────────────────
  'Kengenbet Kenya', 'Kengenbet tips', 'Kengenbet predictions',
  'Kengen bet Kenya', 'Kengen bet tips',

  // ── Tempobet ──────────────────────────────────────────────────────────────
  'Tempobet Kenya', 'Tempobet tips', 'Tempobet predictions',
  'Tempobet free tips', 'Tempobet jackpot tips',

  // ── MyBet ─────────────────────────────────────────────────────────────────
  'MyBet Kenya', 'MyBet tips', 'MyBet predictions',
  'MyBet jackpot tips', 'MyBet free tips',

  // ── SBK ───────────────────────────────────────────────────────────────────
  'SBK Kenya', 'SBK tips', 'SBK predictions', 'SBK free tips',

  // ── Kibet ─────────────────────────────────────────────────────────────────
  'Kibet Kenya', 'Kibet tips', 'Kibet predictions', 'Kibet free tips',

  // ── Betx ──────────────────────────────────────────────────────────────────
  'Betx Kenya', 'Betx tips', 'Betx predictions', 'Betx free tips',

  // ── Jitabet ───────────────────────────────────────────────────────────────
  'Jitabet Kenya', 'Jitabet tips', 'Jitabet predictions',
  'Jitabet jackpot tips', 'Jitabet free tips', 'Jitabet sure tips',

  // ── Nairabet ──────────────────────────────────────────────────────────────
  'Nairabet Kenya', 'Nairabet tips', 'Nairabet predictions',
  'Nairabet free tips', 'Nairabet jackpot tips',

  // ── Eastbet ───────────────────────────────────────────────────────────────
  'Eastbet Kenya', 'Eastbet tips', 'Eastbet predictions',
  'Eastbet free tips', 'Eastbet jackpot tips',

  // ── Afabet ────────────────────────────────────────────────────────────────
  'Afabet Kenya', 'Afabet tips', 'Afabet predictions',
  'Afabet free tips', 'Afabet jackpot tips',

  // ── Premierbet ────────────────────────────────────────────────────────────
  'Premierbet Kenya', 'Premierbet tips', 'Premierbet predictions',
  'Premiumbetkenya', 'PremiumBet Kenya', 'PremiumBet tips',
  'Premierbet jackpot tips', 'Premierbet free tips',

  // ── Bwin ──────────────────────────────────────────────────────────────────
  'Bwin Kenya', 'Bwin tips Kenya', 'Bwin predictions Kenya',
  'Bwin free tips Kenya',

  // ── Spin Sports ───────────────────────────────────────────────────────────
  'Spin Sports Kenya', 'Spin Sports tips', 'Spin Sports predictions',

  // ── Pointsbet ─────────────────────────────────────────────────────────────
  'Pointsbet Kenya', 'Pointsbet tips',

  // ── Mchezopesa ────────────────────────────────────────────────────────────
  'Mchezopesa Kenya', 'Mchezopesa tips', 'Mchezopesa predictions',
  'Mchezopesa jackpot', 'Mchezopesa jackpot tips',

  // ── Bingwa ────────────────────────────────────────────────────────────────
  'Bingwa wa Bets Kenya', 'bingwa bets Kenya', 'Bingwa tips',

  // ── YY Bet ────────────────────────────────────────────────────────────────
  'YY Bet Kenya', 'YY Bet tips', 'YY Bet predictions',

  // ── Lotto Kenya ───────────────────────────────────────────────────────────
  'Lotto Kenya tips', 'Lotto Kenya predictions', 'Kenya Lotto tips',

  // ── International operators active in Kenya ───────────────────────────────
  'BetWinner Kenya', 'BetWinner tips', 'BetWinner predictions',
  'BetWinner free tips', 'BetWinner jackpot tips', 'BetWinner sure tips',
  'Hollywoodbets Kenya', 'Hollywoodbets tips', 'Hollywoodbets free tips',
  'Hollywoodbets predictions', 'Hollywoodbets jackpot tips',
  'bet365 Kenya', 'bet365 tips Kenya', 'bet365 predictions Kenya',
  'bet365 free tips Kenya', 'bet365 accumulator tips Kenya',
  'Betfair Kenya', 'Betfair tips Kenya', 'Betfair exchange Kenya',
  'William Hill Kenya', 'William Hill tips Kenya',
  'Unibet Kenya', 'Unibet tips', 'Unibet predictions Kenya',
  'Pinnacle Kenya', 'Pinnacle tips', 'Pinnacle odds Kenya',
  'SBObet Kenya', 'SBObet tips', 'SBObet predictions Kenya',
  'MarathonBet Kenya', 'Marathon Bet Kenya', 'Marathon Bet tips',
  'Betus Kenya', 'Winner sports bet Kenya',
  'Virtual football tips Kenya', 'virtual bet Kenya',
  'Betturkey Kenya', 'Betturkey tips',

  // ── Free tips (high-volume queries) ────────────────────────────────────
  'free betting tips Kenya', 'free football tips today Kenya',
  'free soccer tips Kenya today', 'free tips Kenya today',
  'free football predictions Kenya', 'free sports predictions Kenya',
  'today free tips Kenya', 'free sure tips Kenya',
  'genuine free tips Kenya', 'legit betting tips Kenya',
  'free tips today', 'free football tips today',
  'free sure football predictions today', 'free football tips that win',
  'best free football tips Kenya', 'best free betting tips in Kenya today',

  // ── General Kenya betting ────────────────────────────────────────────────
  'sports betting Kenya', 'online betting Kenya', 'football betting Kenya',
  'betting tips Kenya today', 'betting predictions Kenya',
  'football tips today Kenya', 'football tips Kenya',
  'football predictions today Kenya', 'soccer tips Kenya',
  'soccer predictions Kenya', 'betting advice Kenya',
  'safe betting tips Kenya', 'sure betting tips Kenya',
  'value betting Kenya', 'smart betting Kenya',
  'betting tips site Kenya', 'sports betting tips Africa',

  // ── Kenya Premier League & African football ─────────────────────────────
  'Kenya Premier League tips', 'KPL predictions', 'KPL tips today',
  'KPL tips', 'KPL free tips', 'Kenya Premier League predictions',
  'KPL match predictions', 'KPL results today', 'KPL standings',
  'Gor Mahia tips', 'AFC Leopards tips', 'Tusker FC tips',
  'KCB FC tips', 'Bandari FC tips', 'Ulinzi Stars tips',
  'Kenya football predictions', 'NSL predictions Kenya',
  'AFCON predictions', 'CAF Champions League tips', 'NPFL tips Nigeria',
  'Ghana Premier League tips', 'AFCON tips', 'CAF tips',
  'South Africa PSL tips', 'Tanzania Premier League tips',
  'Uganda Premier League tips', 'African football tips',
  'FKF Premier League tips', 'FKF Premier League predictions',

  // ── European leagues ────────────────────────────────────────────────────
  'Premier League tips Kenya', 'EPL tips Kenya', 'EPL predictions Kenya',
  'Champions League predictions Kenya', 'UCL tips Kenya',
  'La Liga tips Kenya', 'Serie A tips Kenya', 'Bundesliga tips Kenya',
  'Ligue 1 tips Kenya', 'Europa League tips', 'Conference League tips',
  'FA Cup tips', 'Carabao Cup tips', 'Copa del Rey tips',

  // ── Jackpot ─────────────────────────────────────────────────────────────
  'jackpot predictions Kenya', 'jackpot tips Kenya', 'jackpot tips today Kenya',
  'jackpot banker today', 'jackpot banker Kenya', 'jackpot analysis Kenya',
  'mega jackpot predictions', 'mega jackpot tips', 'grand jackpot tips',
  'jackpot tips free Kenya', 'jackpot winners Kenya', 'jackpot strategies Kenya',
  'how to win jackpot Kenya', 'jackpot accumulator Kenya',
  'SportPesa jackpot 13 games', 'Betika jackpot 17 games',
  'jackpot banker this week Kenya', 'sure jackpot prediction Kenya',
  'jackpot free picks Kenya', 'grand jackpot analysis Kenya',

  // ── Accumulator / odds types ─────────────────────────────────────────────
  'accumulator tips today Kenya', 'acca tips Kenya', 'combo tips Kenya',
  'double tips Kenya', 'treble tips Kenya', 'multi tips Kenya',
  'parlay tips Kenya', '3 odds tips Kenya', '5 odds tips Kenya',
  '10 odds tips Kenya', 'high odds tips Kenya', 'boosted odds Kenya',
  'correct score today Kenya', 'correct score tips Kenya',
  'BTTS tips Kenya', 'both teams to score Kenya', 'BTTS predictions Kenya',
  'over 2.5 goals tips Kenya', 'under 2.5 goals tips',
  'over 1.5 goals tips', 'over 3.5 goals tips Kenya',
  'double chance tips Kenya', 'double chance predictions',
  'Asian handicap tips Kenya', 'handicap tips Kenya',
  'draw tips Kenya', 'home win tips', 'away win tips Kenya',
  'half time full time tips', 'HT FT tips Kenya',
  'anytime scorer tips', 'first goal scorer tips',
  'first team to score tips Kenya', 'correct score free tips Kenya',

  // ── Daily / time-specific ────────────────────────────────────────────────
  'bet of the day Kenya', 'banker of the day Kenya',
  'daily banker Kenya', 'sure bet Kenya', 'sure odds Kenya',
  'daily tips Kenya', 'weekend tips Kenya', 'midweek tips Kenya',
  'Saturday tips Kenya', 'Sunday tips Kenya',
  'today sure tips Kenya', 'tomorrow betting tips Kenya',
  'tonight football tips Kenya', 'this weekend tips Kenya',
  'this week betting tips Kenya',

  // ── M-Pesa & mobile ─────────────────────────────────────────────────────
  'M-Pesa betting Kenya', 'bet with M-Pesa Kenya',
  'M-Pesa sports betting', 'online betting M-Pesa Kenya',
  'deposit via M-Pesa betting', 'withdraw betting winnings M-Pesa',
  'M-Pesa jackpot Kenya', 'Safaricom betting Kenya',

  // ── AI & technology ──────────────────────────────────────────────────────
  'AI football predictions', 'AI betting tips Kenya',
  'AI sports predictor Kenya', 'machine learning football tips',
  'data-driven betting tips', 'statistical football predictions Kenya',
  'xG predictions Kenya', 'form-based tips Kenya',
  'AI prediction site Kenya', 'artificial intelligence football tips',
  'best AI predictor football Kenya', 'AI jackpot predictions Kenya',
  'computer football predictions Kenya', 'algorithm betting tips Kenya',

  // ── Tipster community ────────────────────────────────────────────────────
  'tipster community Kenya', 'best tipsters Kenya',
  'top football tipsters Kenya', 'tipster leaderboard Kenya',
  'follow tipsters Kenya', 'free tipster Kenya', 'pro tipster Kenya',
  'verified tipster Kenya', 'expert betting advice Kenya',
  'betting community Kenya', 'sports tips community Kenya',
  'become a tipster Kenya', 'share betting tips Kenya',
  'tipster ROI Kenya', 'best win rate tipster Kenya',
  'professional sports tipster Kenya',

  // ── Trust & accuracy signals ─────────────────────────────────────────────
  'trusted prediction site Kenya', 'verified tips Kenya',
  'accurate football predictions Kenya', 'high win rate tips Kenya',
  'which site gives correct football predictions Kenya',
  'best site for betting tips in Kenya',
  'legit prediction site Kenya', 'genuine tips Kenya',
  'real football tips Kenya', 'honest tipster Kenya',

  // ── App & platform ───────────────────────────────────────────────────────
  'Kenya betting app', 'betting predictions app Kenya',
  'football tips app Kenya', 'live scores Kenya betting',
  'football results Kenya', 'live football scores Kenya',
  'odds comparison Kenya', 'best odds Kenya',
  'football tips Africa', 'free tips Africa',

  // ── Strategy & education ─────────────────────────────────────────────────
  'responsible gambling Kenya', 'betting strategy Kenya',
  'bankroll management Kenya', '3 daily odds strategy Kenya',
  'compounding strategy betting Kenya',
  'how to bet and win Kenya', 'football betting guide Kenya',
  'betting tips for beginners Kenya', 'sports betting strategy Kenya',
  'how to make money betting Kenya', 'profitable betting strategy Kenya',
  'best strategy for sports betting', 'betting system Kenya',
];

/**
 * Build metadata dynamically so admin-managed branding (site name,
 * description, favicon) and per-page SEO overrides apply automatically.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') || '/';
  const seoEntry = findSeoForPath(parseSeoPages(settings.seo_pages), pathname);

  // Per-path title/description improvements for pages without admin SEO overrides
  const isHomePage = pathname === '/';
  const fallbackTitle = isHomePage
    ? `${settings.site_name} — Best Betting Tips in Kenya | Free AI Football Predictions`
    : `${settings.site_name} - Best Betting Tips & Predictions Kenya`;
  const fallbackDescription = isHomePage
    ? `${settings.site_name} is Kenya's most trusted betting tips site. Get the best free AI-powered football predictions, SportPesa jackpot tips, Betika grand jackpot picks, and daily sure odds. Join 50,000+ bettors who trust Betcheza for the most accurate tips in Kenya.`
    : settings.site_description;

  const title = seoEntry?.title || fallbackTitle;
  const description = seoEntry?.description || fallbackDescription;
  const keywords = seoEntry?.keywords
    ? seoEntry.keywords.split(',').map((k) => k.trim()).filter(Boolean)
    : DEFAULT_KEYWORDS;

  // Build the icons list. If the admin uploaded a custom favicon, prefer it.
  const customFavicon = settings.favicon_url?.trim();
  const icons: Metadata['icons'] = customFavicon
    ? { icon: customFavicon, apple: customFavicon }
    : {
        icon: [
          { url: '/icon.svg', type: 'image/svg+xml' },
          { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        ],
        apple: '/apple-icon.png',
      };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke';
  const canonicalPath = pathname === '/' ? '' : pathname.split('?')[0];

  return {
    title: {
      default: title,
      template: `%s | ${settings.site_name}`,
    },
    description,
    keywords,
    authors: [{ name: settings.site_name }],
    creator: settings.site_name,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: `${siteUrl}${canonicalPath}` },
    robots: seoEntry?.noIndex ? { index: false, follow: false } : undefined,
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://betcheza.co.ke'}${pathname === '/' ? '' : pathname}`,
      siteName: settings.site_name,
      title,
      description,
      images: seoEntry?.ogImage
        ? [{ url: seoEntry.ogImage, width: 1200, height: 630, alt: title }]
        : [{ url: '/og-image.png', width: 1200, height: 630, alt: `${settings.site_name} — Sports Betting Tips` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: seoEntry?.ogImage ? [seoEntry.ogImage] : ['/og-image.png'],
    },
    manifest: '/manifest.json',
    icons,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://betcheza.co.ke/#website',
  name: 'Betcheza',
  alternateName: ['Betcheza Kenya', 'Best Betting Tips Kenya', 'Betcheza Tips', 'betcheza.co.ke'],
  url: 'https://betcheza.co.ke',
  description: "Betcheza is Kenya's most trusted betting tips site — the best free AI football predictions, SportPesa jackpot tips, Betika grand jackpot picks, and daily sure odds.",
  inLanguage: 'en',
  publisher: { '@id': 'https://betcheza.co.ke/#organization' },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://betcheza.co.ke/search?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://betcheza.co.ke/#organization',
  name: 'Betcheza',
  legalName: 'Betcheza',
  alternateName: 'Betcheza Kenya',
  url: 'https://betcheza.co.ke',
  logo: {
    '@type': 'ImageObject',
    url: 'https://betcheza.co.ke/icon-512.png',
    width: 512,
    height: 512,
  },
  image: 'https://betcheza.co.ke/og-image.png',
  description: "Kenya's #1 sports betting tipster community — free AI-powered predictions, jackpot tips, and expert tipster leaderboard.",
  foundingDate: '2024',
  areaServed: { '@type': 'Country', name: 'Kenya' },
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    url: 'https://betcheza.co.ke/contact',
    areaServed: 'KE',
    availableLanguage: 'English',
  },
  sameAs: [
    'https://www.facebook.com/betcheza',
    'https://twitter.com/betcheza',
    'https://www.instagram.com/betcheza',
  ],
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is Betcheza free to use?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, Betcheza is completely free. You can view AI predictions, follow tipsters, and access betting tips at no cost. No subscription or payment is required to browse tips and predictions.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does the AI football predictor work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza uses AI to analyse match data, team form, head-to-head records and odds to generate win probability and market recommendations for each game. Predictions cover over 35 sports and hundreds of leagues globally.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I get SportPesa jackpot tips on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza publishes free AI-powered predictions for SportPesa Midweek Jackpot, SportPesa Mega Jackpot, Betika Grand Jackpot, Odibets jackpot and other Kenyan bookmaker jackpots — updated daily.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I follow a tipster on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Visit the Tipsters page, browse by win rate or ROI, and click any tipster to view their profile and full tip history. Create a free account to follow tipsters and get notifications when they post new tips.',
      },
    },
    {
      '@type': 'Question',
      name: 'How are tipster win rates calculated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Win rates are calculated from settled tips only — the percentage of tips that resulted in a winning outcome. ROI (Return on Investment) factors in the odds of each pick to show long-term profitability.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Betcheza cover the Kenya Premier League (KPL)?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza covers the Kenya Premier League (FKF Premier League) as well as 35+ other sports and leagues including the English Premier League, UEFA Champions League, La Liga, Bundesliga and Serie A.',
      },
    },
    {
      '@type': 'Question',
      name: 'What are the best free betting tips in Kenya today?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza provides the best free betting tips in Kenya today, sourced from AI analysis and a community of over 50,000 verified tipsters. Browse the Matches page for today\'s top predictions across football, basketball, tennis and more.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I get Odibets tips and predictions on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza has a dedicated Odibets tips page with AI-generated predictions tailored for Odibets markets. Visit betcheza.co.ke/tips/odibets for daily Odibets tips and jackpot analysis.',
      },
    },
    {
      '@type': 'Question',
      name: 'How can I win betting competitions on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Join free and paid Betcheza competitions by posting tips on upcoming matches. Your score is based on tip accuracy and odds. Winners earn real KES cash prizes paid directly to your M-Pesa.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does Betcheza support M-Pesa deposits and withdrawals?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza supports M-Pesa deposits and withdrawals via STK push. Deposit with your Safaricom number, receive a confirmation PIN prompt, and funds are added instantly. Competition prize withdrawals also go directly to M-Pesa.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the 3 Daily Odds Strategy on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The 3 Daily Odds Strategy is a bankroll compounding method where you target 3 combined odds per day using singles or doubles. Betcheza\'s Strategy page explains the approach step by step and tracks your projected growth.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I compare Betika jackpot predictions on Betcheza?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Betcheza covers Betika Grand Jackpot with AI-powered selections for all 17 games, plus tipster community picks. Visit betcheza.co.ke/jackpots/betika for the latest Betika jackpot tips and banker selections.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which prediction site has 90% accuracy?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza is consistently rated among the highest-accuracy prediction sites in Kenya. Our AI analyses team form, head-to-head records, expected goals (xG), and odds movement to deliver high-confidence predictions. Top verified tipsters on Betcheza regularly achieve win rates above 70%, and AI-selected banker picks reach accuracy rates exceeding 80% on low-risk markets such as Over 1.5 goals and Double Chance.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the best strategy to win betting?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'The most reliable strategy to win betting consistently in Kenya is the 3 Daily Odds compounding method: stake on 3 combined odds per day, save a portion of each win, and let your bankroll grow over a 7-day cycle. Combine this with value betting — only pick markets where the odds are higher than the true probability — and always use AI predictions to filter high-risk selections. Betcheza\'s Strategy page (betcheza.co.ke/strategy) explains the full 7-day compounding plan step by step.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the most trusted betting tips site?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza (betcheza.co.ke) is the most trusted betting tips site in Kenya. Every tipster is verified, all results are recorded publicly, and no tips are altered after events start. The AI predictor is powered by real match data, and win rates are calculated transparently from settled picks only. Betcheza is free to use and has been trusted by over 50,000 Kenyan bettors.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which AI is best for football prediction?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza\'s AI football predictor is one of the best in Kenya for football predictions. It uses machine learning models trained on match statistics, team form, injuries, head-to-head records, and real-time odds data. The AI generates win probability percentages and recommends the best market for each match — available free at betcheza.co.ke/predictor.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which is the best prediction site in Kenya?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Betcheza is widely considered the best prediction site in Kenya. It combines an AI football predictor, a leaderboard of verified expert tipsters, free jackpot predictions for SportPesa and Betika, and a community feed where bettors share and discuss tips. All predictions are free, transparent, and updated daily.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I get free football predictions in Kenya today?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Visit betcheza.co.ke to get free football predictions in Kenya today. The Matches page shows AI-powered tips for every fixture, including Over/Under, BTTS, Correct Score and 1X2 markets. The Strategy page gives you 3 daily sure odds picks updated every morning. No login required to browse free tips.',
      },
    },
  ],
};

const softwareAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  '@id': 'https://betcheza.co.ke/#app',
  name: 'Betcheza',
  url: 'https://betcheza.co.ke',
  description: "Kenya's #1 free sports betting tips platform — AI predictions, jackpot tips, tipster leaderboard and cash prize competitions.",
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  browserRequirements: 'Requires JavaScript',
  inLanguage: 'en',
  isAccessibleForFree: true,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'KES',
    availability: 'https://schema.org/InStock',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    bestRating: '5',
    worstRating: '1',
    ratingCount: '2400',
  },
  publisher: { '@id': 'https://betcheza.co.ke/#organization' },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={geist.variable} suppressHydrationWarning>
      <head />
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <ClarityAnalytics />
        <NavigationProgress />
        <ServiceWorkerRegister />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <AuthModalProvider>
              <BetSlipProvider>
              <UserSettingsProvider>
                {children}
                <ClientModals />
                <Toaster position="top-right" richColors closeButton />
              </UserSettingsProvider>
            </BetSlipProvider>
            </AuthModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
