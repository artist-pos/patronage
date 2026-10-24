import { COPY } from "@/lib/rabobank/artist-copy";
import { Scene } from "../../survey/[token]/SurveyExperience";
import "../../survey/[token]/survey.css";
import "./artist-flow.css";

/** Frame for the short artist pages (closed, keep-or-delete): the staff survey's look. */
export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rb" data-phase="questions" style={{ ["--p" as string]: 0.5 }}>
      <Scene p={0.5} />
      <div className="rb-stage">
        <div className="rb-col rb-in">{children}</div>
      </div>
    </div>
  );
}

export function ClosedNotice() {
  return (
    <div role="status">
      <p className="rb-eyebrow">{COPY.landing.eyebrow}</p>
      <h1 className="rb-title">{COPY.closed.heading}</h1>
      <p className="rb-copy">{COPY.closed.body}</p>
    </div>
  );
}
