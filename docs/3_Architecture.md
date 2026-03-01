1. Tech Stack

    Frontend: Next.js (App Router).

    Backend/DB: Supabase (Auth + PostgreSQL + Storage).

    Styling: Tailwind CSS + Shadcn UI.

    Infrastructure: Vercel.

2. Data Consistency (Enums)
To ensure data integrity for filtering, the following Enums must be defined in Postgres:

    country_enum: ('NZ', 'AUS', 'Global')

    role_enum: ('artist', 'admin')

    stage_enum: ('Emerging', 'Mid-Career', 'Established', 'Open')

    opp_type_enum: ('Grant', 'Residency', 'Commission', 'Open Call', 'Prize', 'Display')

3. Performance & Indexing
Include B-Tree indexes on high-traffic filter columns:

    opportunities(deadline)

    opportunities(country)

    profiles(username)

4. Email Strategy
Weekly email digest. Build a logic to query "New" and "Closing Soon" opportunities.

    Fallback: Admin must be able to export a CSV of subscribers and relevant opportunities for a manual send if automation exceeds the 4-week build window.