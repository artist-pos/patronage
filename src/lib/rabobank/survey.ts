export const ART_RELATION = [
  "Art matters to me — I seek it out",
  "I enjoy it, but don’t know much about it",
  "I don’t really notice it",
  "I’m not sure it adds much",
] as const;

export const ROOM_WANTS = [
  "Makes the room feel distinctly Te Puke",
  "Reflects the people, work and relationships that shape this region",
  "Shows what the bank and its clients build together",
  "Gives people something to talk about",
  "Offers a fresh perspective on something familiar",
  "Holds its own in the room, even when things are busy",
  "Makes the room feel welcoming",
] as const;

export const MAX_ROOM_WANTS = 3;

/** Picking this clears the other uses, and picking any other use clears it. */
export const ROOM_USES_NONE = "I haven’t seen the space in use";
export const ROOM_USES = [
  "Client meetings and presentations",
  "Staff gatherings and team events",
  "Community or grower events",
  "Training and workshops",
  "Informal catch-ups and coffees",
  "Formal functions and celebrations",
  ROOM_USES_NONE,
] as const;
export const MAX_ROOM_USES = 3;

export const LIMITS = {
  firstName: 60,
  artNote: 200,
  story: 500,
  place: 300,
  cooperation: 500,
  artist: 200,
  wrong: 200,
  memory: 200,
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
  | (QuestionBase & { kind: "multi"; field: MultiField; options: readonly string[]; max: number; exclusive?: string });

export type TextField = "story" | "place" | "cooperation" | "artist" | "wrong" | "memory";
export type MultiField = "roomUses" | "roomWants";

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
    help: "It could be a landscape, a familiar place, a local story or something from everyday life.",
    limit: LIMITS.place,
  },
  {
    key: "cooperation",
    kind: "text",
    field: "cooperation",
    eyebrow: "What it made possible",
    title: "Can you think of a time people working together made something possible that wouldn’t have happened otherwise? What happened?",
    help: "It could involve clients, colleagues, growers or the wider community. A particular moment is welcome, even a single image that sums it up.",
    limit: LIMITS.cooperation,
  },
  {
    key: "artist",
    kind: "text",
    field: "artist",
    eyebrow: "Local makers",
    title: "Is there a local artist or maker whose work you know and love?",
    help: "Someone from Te Puke or the wider Bay of Plenty is especially welcome. A name or link is enough.",
    limit: LIMITS.artist,
  },
  {
    key: "uses",
    kind: "multi",
    field: "roomUses",
    eyebrow: "The room in use",
    title: "When the event space is in use, what’s usually happening?",
    help: "Pick up to three.",
    options: ROOM_USES,
    max: MAX_ROOM_USES,
    exclusive: ROOM_USES_NONE,
  },
  {
    key: "room",
    kind: "multi",
    field: "roomWants",
    eyebrow: "The room",
    title: "When the event space is in use, what should the artwork be doing?",
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
    title: "Has an artwork ever stayed with you? What was it, and why?",
    help: "It could be something you’ve seen anywhere, not just in a gallery.",
    optional: true,
    limit: LIMITS.memory,
  },
];
