export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Patronage</span>
        <span>Connecting artists with opportunity in Aotearoa and beyond.</span>
      </div>
    </footer>
  );
}
