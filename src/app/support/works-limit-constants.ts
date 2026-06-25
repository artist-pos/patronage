// Plain constants shared by the /support page, the works-limit server action,
// and the SupportWorks client component. Kept out of the "use server" file
// because that module may only export async functions.

export const SUPPORT_WORKS_LIMIT_KEY = "support_works_limit";
export const SUPPORT_WORKS_MAX = 48;
export const SUPPORT_WORKS_DEFAULT = 12;
