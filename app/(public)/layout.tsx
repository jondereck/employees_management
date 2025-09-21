export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // no auth checks here — keep it bare
  return children;
}