// How it works: the concept paper's four design principles, beside the room.
const STEPS = [
  ["Curiosity", "Something is always being made by the windows, so people passing look up and come in."],
  ["Comfort", "Couches, coffee and a host who says hello. Staying without buying anything is normal."],
  ["Participation", "Workshops, crits, open studios and family sessions give everyone something to join."],
  ["Wonder", "A new exhibition every three weeks, and headline events, give people a reason to return."],
];

export function VisitMap() {
  return (
    <div className="ht-visit">
      <div className="ht-shot" style={{ aspectRatio: "3 / 2" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/here-together/trust-2.jpg" alt="The room as it is today" className="h-full w-full object-cover" />
      </div>
      <ol className="ht-steps">
        {STEPS.map(([name, body]) => (
          <li key={name}>
            <span className="ht-steps-name">{name}</span>
            <span className="ht-steps-body">{body}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
