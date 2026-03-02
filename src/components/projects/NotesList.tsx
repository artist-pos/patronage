import type { NoteWithSender } from "@/types/database";

interface Props {
  notes: NoteWithSender[];
}

export function NotesList({ notes }: Props) {
  if (notes.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
        Notes
      </h2>
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className="text-sm leading-relaxed">
            <span className="font-semibold">From {note.sender_name}: </span>
            <span>{note.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
