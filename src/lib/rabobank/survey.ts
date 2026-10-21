export const ART_RELATION = [
  "I love having art around",
  "I like it when it says something about a place or its people",
  "I like it when it gives me something to think about",
  "I enjoy looking, but don't know much about art",
  "I don't really notice it",
  "I'm not sure it adds much",
  "It depends",
] as const;

export const ROOM_WANTS = [
  "A sense of welcome",
  "A reason to start a conversation",
  "A feeling of connection to Te Puke and the region",
  "A reflection of the relationships between Rabobank, its clients and the community",
  "A sense of how land, people and production are connected",
  "Pride in the people and work of this region",
  "A moment of calm amid a busy day",
  "Something unexpected",
  "Something else",
  "Nothing in particular",
] as const;

/** Picking this clears the others, and picking any other clears it. */
export const NOTHING_IN_PARTICULAR = "Nothing in particular";
export const MAX_ROOM_WANTS = 3;

export const LIMITS = {
  firstName: 60,
  artNote: 200,
  story: 300,
  wrong: 200,
  memory: 200,
  artist: 200,
} as const;

export interface QuestionBase {
  key: string;
  eyebrow: string;
  title: string;
  help?: string;
  optional?: boolean;
}
export type Question =
  | (QuestionBase & { kind: "text"; field: TextField; limit: number })
  | (QuestionBase & { kind: "single"; field: "artRelation"; options: readonly string[]; note: { field: "artNote"; limit: number; label: string } })
  | (QuestionBase & { kind: "multi"; field: "roomWants"; options: readonly string[]; max: number });

export type TextField = "story" | "place" | "cooperation" | "wrong" | "memory" | "artist";

export const QUESTIONS: Question[] = [
  {
    key: "art",
    kind: "single",
    field: "artRelation",
    eyebrow: "You and art",
    title: "What’s your relationship with art?",
    help: "There’s no right answer. Tell me as much or as little as you like.",
    options: ART_RELATION,
    note: { field: "artNote", limit: LIMITS.artNote, label: "Optional comment" },
  },
  {
    key: "together",
    kind: "text",
    field: "story",
    eyebrow: "Working together",
    title:
      "Has there been a time when working with a client or someone in the community felt like more than just doing business? What’s the story?",
    help: "Please don’t include names or confidential details.",
    limit: LIMITS.story,
  },
  {
    key: "place",
    kind: "text",
    field: "place",
    eyebrow: "Place",
    title:
      "Is there a place around Te Puke, or a local story or tradition, that you hold dear? What makes it meaningful to you?",
    limit: LIMITS.story,
  },
  {
    key: "cooperation",
    kind: "text",
    field: "cooperation",
    eyebrow: "Cooperation",
    title: "What do you value about the way people in this region work together?",
    help:
      "It could be something you’ve experienced with clients, colleagues, growers or the wider community. A particular moment or example is welcome.",
    limit: LIMITS.story,
  },
  {
    key: "room",
    kind: "multi",
    field: "roomWants",
    eyebrow: "The room",
    title:
      "Imagine the event space is full. People are meeting, talking, sharing ideas or working through a problem together. What would you want the artwork to bring to that moment?",
    help: "Pick up to three.",
    options: ROOM_WANTS,
    max: MAX_ROOM_WANTS,
  },
  {
    key: "wrong",
    kind: "text",
    field: "wrong",
    eyebrow: "What wouldn’t fit",
    title: "What would make an artwork feel wrong for this room?",
    help:
      "It could be a subject, a style, something too obvious, or something that just wouldn’t feel like it belongs. It’s also fine if you’re sceptical about having art here.",
    limit: LIMITS.wrong,
  },
  {
    key: "memory",
    kind: "text",
    field: "memory",
    eyebrow: "A memory",
    title: "Has an artwork ever made you stop, look twice or hold a memory? What’s the story?",
    help: "It could be something you’ve seen anywhere, not just in a gallery.",
    optional: true,
    limit: LIMITS.memory,
  },
  {
    key: "artist",
    kind: "text",
    field: "artist",
    eyebrow: "Local makers",
    title: "Is there a local artist or maker whose work you know and love?",
    help: "Someone from Te Puke or the wider Bay of Plenty is especially welcome. A name or link is enough.",
    optional: true,
    limit: LIMITS.artist,
  },
];
