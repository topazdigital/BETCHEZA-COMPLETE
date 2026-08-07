import { ArrowUpRight } from 'lucide-react';

const WHATSAPP_GROUP_URL =
  'https://chat.whatsapp.com/CiQQ3J6o0A4E8eXZ4Y9QaN?s=cl&p=a&mlu=4';

function WhatsAppMark({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 32 32"
      fill="none"
    >
      <path
        d="M16 3.25C8.96 3.25 3.25 8.96 3.25 16c0 2.25.59 4.36 1.62 6.19L3.3 28.7l6.66-1.5A12.7 12.7 0 0 0 16 28.75c7.04 0 12.75-5.71 12.75-12.75S23.04 3.25 16 3.25Z"
        fill="currentColor"
      />
      <path
        d="M21.48 18.6c-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.17.2-.35.23-.65.08-.3-.15-1.26-.46-2.4-1.46-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.24-.25-.59-.5-.5-.68-.51h-.58c-.2 0-.53.08-.8.38-.27.3-1.03 1-1.03 2.45s1.05 2.84 1.2 3.04c.15.2 2.07 3.16 5.02 4.43.7.3 1.25.48 1.68.62.7.22 1.33.19 1.83.12.56-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.08-.13-.28-.2-.58-.35Z"
        fill="white"
      />
    </svg>
  );
}

export function WhatsAppCommunityCta() {
  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join the Betcheza WhatsApp community"
      className="group relative mb-4 flex max-w-xl items-center gap-3 overflow-hidden rounded-2xl border border-emerald-400/30 bg-[linear-gradient(105deg,#064e3b_0%,#087f5b_52%,#16a36b_100%)] px-3 py-3 text-white shadow-[0_10px_35px_-14px_rgba(16,185,129,0.9)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(16,185,129,0.9)] focus-visible:outline-white sm:gap-4 sm:px-4"
    >
      <span className="pointer-events-none absolute -right-8 -top-12 h-28 w-28 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#087f5b] shadow-lg shadow-black/15">
        <WhatsAppMark className="h-7 w-7" />
        <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#087f5b] bg-lime-300" />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
          Betcheza community
        </span>
        <span className="mt-0.5 block truncate text-sm font-bold sm:text-[15px]">
          Get the conversation, picks &amp; match energy
        </span>
      </span>
      <span className="relative flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-[#087f5b] shadow-sm transition-colors group-hover:bg-emerald-50">
        Join now
        <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

export function WhatsAppMarkIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <WhatsAppMark className={className} />;
}