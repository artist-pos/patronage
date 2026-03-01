export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Patronage</span>
        <span>Connecting artists with opportunity in Aotearoa and beyond.</span>
      </div>
    </footer>
  );
}
