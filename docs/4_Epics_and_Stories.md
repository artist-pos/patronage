Epic 1: The Foundations

    Story 1.1: Setup Next.js, Tailwind, and Shadcn. Establish the "Institutional Minimalist" theme.

    Story 1.2: Configure Supabase with Auth and defined Enums/Tables. Set up RLS (Row Level Security) so artists can only edit their own data.

    Story 1.3: Build the public "For Partners" page (Focus on: "List an Opportunity" and "Managed Submissions").

Epic 2: The Opportunity Engine

    Story 2.1: Implement the Opportunities table with auto-expiry logic (deadline >= now).

    Story 2.2: Build the Opportunities search page with faceted filtering (Enums used for dropdowns).

    Story 2.3: Create the Admin CSV Upload tool. Map CSV headers to the DB schema.

Epic 3: Identity & Profiles

    Story 3.1: Artist onboarding flow: Auth -> Profile Setup -> Medium/Stage selection.

    Story 3.2: Portfolio component: Upload 5–10 images to Supabase Storage with automatic resizing/optimization.

    Story 3.3: Vanity URL routing: /[username] displays the artist's professional profile.

Epic 4: Admin & Moderation

    Story 4.1: Build Admin Dashboard with a "Global Switch" to deactivate users or delete items.

    Story 4.2: Setup basic analytics dashboard for profile and opportunity counts.

Epic 5: Communication & Launch

    Story 5.1: Build the Weekly Digest logic and integrate a simple email capture form on the home page.

    Story 5.2: Final mobile-responsiveness pass and Vercel deployment.