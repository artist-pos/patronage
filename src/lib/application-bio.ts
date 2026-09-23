// Reserved key inside opportunity_applications.custom_answers holding a bio the
// applicant wrote for one specific opportunity (separate from profiles.bio).
// Lives in the existing jsonb so it needs no migration; question ids never
// start with "__" so it can't collide with a real question.
export const APPLICATION_BIO_KEY = "__bio";
