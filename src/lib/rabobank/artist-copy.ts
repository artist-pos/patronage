/**
 * Every word on the invited-artist pages and in their emails.
 *
 * Strings given verbatim in the build brief are written out. Everything else is
 * a named placeholder, `[[copy.md: <key>]]` or `[[brief.md]]`, to be replaced
 * with Blake's copy.md and brief.md. Edit text here only; no component holds copy.
 *
 * House rules: NZ English, no em dashes anywhere, never mention a budget.
 */

const P = (key: string) => `[[copy.md: ${key}]]`;

export const CONSENT_VERSION = "v1-draft";

export const COPY = {
  meta: {
    // Link previews (Open Graph) must not show names, prices or artwork.
    title: "Commission invitation",
    description: "A Patronage commission page.",
  },

  landing: {
    eyebrow: "Rabobank Te Puke · Event Space Artwork",
    greeting: (firstName: string) => `Kia ora ${firstName},`,
    featuredCredit: P("landing.featuredCredit"),
    siteLink: P("landing.siteLink"),
    briefHeading: P("landing.briefHeading"),
    /** The one-page trimmed narrative. Paragraphs are split on blank lines. */
    briefBody: "[[brief.md]]",
    wallHeading: P("landing.wallHeading"),
    partsHeading: P("landing.partsHeading"),
    profileRequired: P("landing.profileRequired"),
    deadline: (date: string) => `${P("landing.deadlinePrefix")} ${date}`,
    status: { not_started: "Not started", saved: "Saved", done: "Done" },
    stageLabel: (n: number) => `Part ${n}`,
    startOne: "Start part 1",
    continueOne: P("landing.continueOne"),
    editOne: P("landing.editOne"),
    startTwo: "Start part 2",
    continueTwo: P("landing.continueTwo"),
    editTwo: P("landing.editTwo"),
  },

  /** The question-by-question controls, as in the staff survey. */
  flow: {
    next: "Next",
    back: "Back",
    skip: "Skip",
    hint: "or press Enter",
    stepOf: (part: string, n: number, total: number) => `${part} · ${n} of ${total}`,
  },

  partOne: {
    short: "Part one",
    title: "Part one: Your response to the commission",
    summary:
      "Tell me whether this suits you, how you'd approach it, and what you'd quote. This goes to me and to Mark at Rabobank. About ten minutes.",
    q: {
      interested: { label: "Does this suit you?", help: P("partOne.interested.help") },
      questions: { label: P("partOne.questions.label"), help: P("partOne.questions.help") },
      deliver: { label: "Can you deliver the finished, ready-to-hang work by mid January?", help: P("partOne.deliver.help") },
      workType: { label: "New work or an existing piece?", help: P("partOne.workType.help") },
      existingImages: { label: P("partOne.existingImages.label"), help: P("partOne.existingImages.help") },
      approach: {
        label: "Your approach",
        help: "A few sentences on how you'd respond to the space, plus the medium and roughly how it would look.",
      },
      quote: {
        label: "Your quote, excluding framing and installation",
        help: "Please quote the 1800 x 900. The 1600 x 800 is optional but helpful.",
        fee1800: "1800 x 900 mm",
        fee1600: "1600 x 800 mm",
        gstToggle: "GST included?",
        altSize: "If a different size suits your work better, tell me.",
      },
      framing: {
        label: "Framing",
        help: "The work will be framed; the frame style will be agreed with you.",
        cost: P("partOne.framing.cost"),
        recommendation: P("partOne.framing.recommendation"),
      },
      install: {
        label: "Installation",
        help: "The work will be installed at the branch in Te Puke.",
        cost: P("partOne.install.cost"),
        recommendation: P("partOne.install.recommendation"),
        basedIn: P("partOne.install.basedIn"),
      },
      leadTime: { label: "How many weeks do you need from appointment to a finished work?", help: P("partOne.leadTime.help") },
      anythingElse: { label: "Anything else that affects price or timing", help: P("partOne.anythingElse.help") },
    },
    options: {
      interested: [
        ["yes", "Yes"],
        ["yes_with_questions", "Yes, with a couple of questions"],
        ["no", "No thanks"],
      ],
      deliver: [
        ["yes", "Yes"],
        ["date", "I'd need until a date"],
      ],
      workType: [
        ["new", "New for the space"],
        ["existing", "Existing that fits"],
        ["either", "Either"],
      ],
      who: [
        ["self", "I'll do this myself"],
        ["other", "I'd like someone else to do it, and Patronage can arrange it"],
        ["unsure", "Not sure yet"],
      ],
    },
    submit: P("partOne.submit"),
    declined: {
      heading: P("partOne.declined.heading"),
      body: P("partOne.declined.body"),
      suggestLabel: "Anyone you'd suggest?",
      suggestHelp: P("partOne.declined.suggestHelp"),
      suggestSave: P("partOne.declined.suggestSave"),
      suggestSaved: P("partOne.declined.suggestSaved"),
    },
    errors: {
      required: P("errors.required"),
      fee1800: P("errors.fee1800"),
      amount: P("errors.amount"),
      tooLong: P("errors.tooLong"),
      closed: P("errors.closed"),
    },
  },

  thanks: {
    heading: P("thanks.heading"),
    body: P("thanks.body"),
    next: P("thanks.next"),
    partTwoWhy: P("thanks.partTwoWhy"),
    partTwoButton: P("thanks.partTwoButton"),
  },

  partTwo: {
    short: "Part two",
    title: "Part two: About you",
    summary:
      "A short biography, a photo and a few of your works, so the team at the Te Puke branch can get to know you. You can also choose to keep it as a Patronage profile.",
    q: {
      photo: { label: "Photo of you", help: P("partTwo.photo.help") },
      name: { label: "Name as you'd like it shown", help: P("partTwo.name.help") },
      location: { label: "Where you're based", help: P("partTwo.location.help") },
      bio: { label: "Short biography", help: "80 to 150 words." },
      website: { label: P("partTwo.website.label") },
      instagram: { label: P("partTwo.instagram.label") },
      otherLinks: { label: P("partTwo.otherLinks.label") },
      works: { label: P("partTwo.works.label"), help: P("partTwo.works.help") },
      staffPrompt: { label: "What would you like someone to feel standing in front of your work?", help: P("partTwo.staffPrompt.help") },
      choice: { label: P("partTwo.choice.label") },
      consent: { label: P("partTwo.consent.label"), body: P("partTwo.consent.body") },
      keepEmail: { label: P("partTwo.keepEmail.label") },
    },
    worksCount: (n: number, min: number, max: number) => `${n} of ${min} to ${max}`,
    words: (n: number) => `${n} ${n === 1 ? "word" : "words"}`,
    choices: [
      ["keep", "Yes, keep this as my Patronage profile."],
      ["private_only", "Not now, use it only for the Rabobank selection."],
    ],
    work: {
      title: P("partTwo.work.title"),
      year: P("partTwo.work.year"),
      medium: P("partTwo.work.medium"),
      size: P("partTwo.work.size"),
      note: P("partTwo.work.note"),
      add: P("partTwo.work.add"),
      remove: P("partTwo.work.remove"),
    },
    submit: P("partTwo.submit"),
    errors: {
      name: P("errors.name"),
      bio: P("errors.bio"),
      works: P("errors.works"),
      choice: P("errors.choice"),
      consent: P("errors.consent"),
      email: P("errors.email"),
      upload: P("errors.upload"),
      closed: P("errors.closed"),
    },
  },

  done: {
    heading: P("done.heading"),
    body: P("done.body"),
    next: P("done.next"),
    keepSent: P("done.keepSent"),
  },

  saving: { saving: "Saving", saved: "Saved", offline: P("saving.offline") },

  closed: {
    heading: P("closed.heading"),
    body: P("closed.body"),
  },

  keep: {
    heading: P("keep.heading"),
    body: P("keep.body"),
    button: P("keep.button"),
    done: P("keep.done"),
    viewProfile: P("keep.viewProfile"),
    wrongAccount: P("keep.wrongAccount"),
  },

  followup: {
    heading: P("followup.heading"),
    keepButton: P("followup.keepButton"),
    deleteButton: P("followup.deleteButton"),
    confirmKeep: P("followup.confirmKeep"),
    confirmDelete: P("followup.confirmDelete"),
    deleted: P("followup.deleted"),
  },

  email: {
    followupSubject: P("email.followupSubject"),
    followupBody: P("email.followupBody"),
    reminderSubject: P("email.reminderSubject"),
    reminderBody: P("email.reminderBody"),
    keepSubject: P("email.keepSubject"),
    keepBody: P("email.keepBody"),
    signoff: "Blake Aitken, Patronage",
  },
} as const;
