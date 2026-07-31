// generateMetadata for the article page lives in page.tsx (not here) because
// Next.js layouts do NOT receive searchParams — only pages do.
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
