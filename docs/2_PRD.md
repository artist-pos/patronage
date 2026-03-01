1. Functional Requirements

    1.1 Discovery (Public): All opportunity and artist browsing is 100% public. No "walled garden." Login is only for profile management and admin tasks.

    1.2 Artist Directory: Grid/List views. Filters: Country, Medium, Career Stage.

    1.3 Artist Profiles: Shareable vanity URLs (patronage.nz/[username]). Space for 5–10 portfolio items. CV upload (PDF).

    1.4 Opportunity Engine: Advanced search with auto-expiry logic (past deadlines hide automatically).

    1.5 Admin Panel: Manual moderation tools. Admins can deactivate users, delete inappropriate content, and mark artists as patronage_supported.

    1.6 Bulk Operations: Admin capability to upload opportunities via CSV.

2. Non-Functional Requirements

    Performance: Minimalist design with zero "bloatware." Instant-load search results.

    Design: White background, strong black typography, no gradients, no "playful" animations. Institutional calm.

    Analytics: Basic tracking of active profiles, active opportunities, and weekly traffic via Vercel Analytics or Plausible.

3. Scope Exclusions (v1.0)

    No messaging, likes, or comments.

    No payment systems or patron accounts.

    No "I Applied" tracking (Deferred to v1.1).