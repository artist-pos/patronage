import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CARD_BG = "#111111";
const BORDER = "#262626";
const MUTED = "#666666";
const DIM = "#444444";

function Tag({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: 11,
        color: MUTED,
        border: `1px solid ${BORDER}`,
        padding: "2px 8px",
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function OpportunityCard({
  title,
  sub,
  deadline,
  tag,
}: {
  title: string;
  sub: string;
  deadline: string;
  tag: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        backgroundColor: CARD_BG,
        border: `1px solid ${BORDER}`,
        padding: "18px 22px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", flex: 1, marginRight: 12 }}>
          {title}
        </div>
        <Tag label={tag} />
      </div>
      <div style={{ fontSize: 13, color: MUTED }}>{sub}</div>
      <div style={{ fontSize: 12, color: DIM }}>{deadline}</div>
    </div>
  );
}

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: 1200,
          height: 630,
          backgroundColor: "#000",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* ── Left panel ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "64px 56px",
            width: 460,
            borderRight: `1px solid ${BORDER}`,
          }}
        >
          {/* Wordmark */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-2px",
              lineHeight: 1,
              marginBottom: 16,
            }}
          >
            Patronage
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 17,
              color: MUTED,
              lineHeight: 1.5,
              marginBottom: 44,
            }}
          >
            Professional Profiles and Opportunities{"\n"}for Australasian Artists
          </div>

          {/* Feature bullets */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "E-portfolio & CV",
              "Grants & Residencies",
              "Open Calls & Jobs",
              "Free for Artists",
            ].map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    backgroundColor: "#fff",
                    borderRadius: "50%",
                    flexShrink: 0,
                  }}
                />
                <div style={{ fontSize: 15, color: "#888" }}>{item}</div>
              </div>
            ))}
          </div>

          {/* URL */}
          <div style={{ marginTop: 52, fontSize: 13, color: DIM }}>
            patronage.nz
          </div>
        </div>

        {/* ── Right panel ── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 52px",
            gap: 14,
            flex: 1,
          }}
        >
          {/* Section label */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: DIM,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              marginBottom: 4,
            }}
          >
            Opportunities Directory
          </div>

          <OpportunityCard
            title="Archibald Prize"
            sub="Art Gallery of NSW · Australia"
            deadline="Deadline: 30 June 2025"
            tag="Grant"
          />
          <OpportunityCard
            title="Gallery Coordinator"
            sub="Meanwhile Gallery · New Zealand"
            deadline="Open until filled"
            tag="Job"
          />
          <OpportunityCard
            title="Creative NZ Arts Grant"
            sub="Creative New Zealand · New Zealand"
            deadline="Deadline: 15 August 2025"
            tag="Residency"
          />

          {/* Footer note */}
          <div
            style={{
              fontSize: 12,
              color: DIM,
              marginTop: 6,
              paddingLeft: 4,
            }}
          >
            + hundreds more opportunities listed
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
