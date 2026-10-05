/**
 * A short note from Blake, signed. Used only where a relationship is being
 * formed (signup prompts) — system and transactional copy stays neutral.
 * Kept out of SignupPromptModal so callers can build a note without pulling
 * the lazily loaded popup into their own bundle.
 */
export function BlakeNote({ children }: { children: React.ReactNode }) {
  return (
    <>
      <p>{children}</p>
      <p className="mt-2 font-mono text-xs text-[color:var(--fg-subtle)]">— Blake</p>
    </>
  );
}
