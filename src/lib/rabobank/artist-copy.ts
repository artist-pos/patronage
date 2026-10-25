/**
 * Every word on the invited-artist pages and in their emails, from Blake's
 * copy.md and brief.md. Edit text here only; no component holds copy.
 *
 * House rules: NZ English, no em dashes anywhere, never mention a budget.
 * Curly-brace tokens ({firstName}, {keepLink}...) are filled in with fill().
 */

export const CONSENT_VERSION = "v1";

/** Blake's contact address for privacy requests (the {contactEmail} in the consent text). */
export const CONTACT_EMAIL = "blake@patronage.nz";

/** Replaces {token}s in a copy string. Unknown tokens are left as they are. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
}

export const COPY = {
  meta: {
    // Link previews (Open Graph) must not show names, prices or artwork.
    title: "Commission invitation",
    description: "A Patronage commission page.",
  },

  landing: {
    eyebrow: "Rabobank Te Puke · Event Space Artwork",
    greeting: (firstName: string) => `Kia ora ${firstName},`,
    roomCaption: "The event space",
    featuredCredit: "Image from",
    briefHeading: "The commission",
    /** brief.md: the short creative direction. Paragraphs are split on blank lines; one wrapped in _underscores_ is set in italics. */
    briefBody: `Rabobank is refreshing their Te Puke branch. I have been tasked with developing a narrative and commissioning an artwork for their event space. It is a room used for events and informal meetings, bringing together clients, the community and staff.

The work will hang on a dark blue wall, 3600mm wide by 2400mm high, centred on the wall. I would love you to quote for two sizes, 1800mm wide by 900mm high and 1600mm wide by 800mm high, excluding the frame. The work will be framed and installed at the branch, with the frame styling to be agreed with the successful artist.

_The theme is Together. The bank was built through cooperation, and the event space is where that is most visible: people, knowledge, production and relationships coming together to make something none of them could achieve alone. I’m interested in a work that gives clients, the community and staff something to gather around, with enough presence to hold the wall from across the room. I’d like it to feel considered and rooted in this place, and comfortable in a banking environment without feeling corporate._

Once your response has been received, the team at the Te Puke branch will have a chance to view your work and read a bit about you. I will get back to you regarding selection in early to mid November. The finished work, including framing, will be delivered and installed in January.`,
    directionButton: "Read the creative direction (PDF)",
    wallHeading: "The wall",
    partsHeading: "Your response",
    profileRequired:
      "The team at the branch can only consider artists who have added a profile, so please complete both parts. You can send your quote first and come back to part two, as long as you finish before the closing date.",
    deadline: (date: string) => `Please respond by ${date}`,
    status: { not_started: "Not started", saved: "Saved", done: "Done" },
    stageLabel: (n: number) => `Part ${n}`,
    startOne: "Begin",
    continueOne: "Continue part one",
    editOne: "Edit your response",
    startTwo: "Begin part two",
    continueTwo: "Continue part two",
    editTwo: "Edit your profile",
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
      "Tell me whether this suits you, how you'd approach it, and what you'd quote. This goes to me and to Mark at Rabobank.",
    /** Shown as a clock pill beside the status. */
    duration: "10 min" as string | null,
    q: {
      interested: { label: "Does this interest you?", help: "Be as honest about fit as you like. A no is useful to me too." },
      questions: {
        label: "What would you like to ask?",
        help: "Add each question on its own line and I will reply by email before the closing date.",
        line: (n: number) => `Question ${n}`,
        add: "Add another question",
      },
      deliver: {
        label: "Can you complete the work by early to mid January?",
        help: "The framing will be organised to coincide with the completion of the artwork, so we make the most of the time. If you need longer, let me know what works for you.",
      },
      scale: {
        label: "Have you made work at this scale before?",
        help: "There is no wrong answer. It helps me understand the handling and delivery involved, and Rabobank will want to know.",
      },
      approach: {
        label: "Your approach",
        help: "Having read the creative direction, how would you respond to the space? A few sentences on the idea, the medium, and roughly how it would look.",
      },
      takes: { heading: "Just a thought" },
      quote: {
        label: "Your quote, excluding framing and installation",
        help: "Please quote the 1800 x 900. The 1600 x 800 is optional but helpful.",
        fee1800: "1800 x 900 mm",
        fee1600: "1600 x 800 mm",
        gst: {
          label: "These amounts are",
          options: [
            ["plus", "Plus GST"],
            ["incl", "Including GST"],
            ["none", "I am not GST registered, so no GST applies"],
          ],
        },
        altSize: "If a different size suits your work better, tell me.",
      },
      framing: {
        label: "Framing",
        help: "The work will be framed; the frame style will be agreed with you.",
        cost: "Indicative cost, if you know it",
        recommendation: "Anyone you would recommend?",
      },
      install: {
        label: "Installation",
        help: "The work will be installed at the branch in Te Puke.",
        cost: "Indicative cost, if you know it",
        recommendation: "Anyone you would recommend?",
        basedIn: "Where you are based",
      },
      anythingElse: {
        label: "Anything else that affects price or timing",
        help: "For example your availability, materials, or anything in the creative direction you would want to talk through.",
      },
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
      scale: [
        ["often", "Yes, often"],
        ["some", "Once or twice"],
        ["largest", "This would be my largest"],
      ],
      who: [
        ["self", "I'll do this myself"],
        ["other", "I'd like someone else to do it, and Patronage can arrange it"],
        ["unsure", "Not sure yet"],
      ],
    },
    submit: "Send my response",
    declined: {
      heading: "Thank you for letting me know",
      body: "Thank you for looking at the brief and for being straightforward about fit. I appreciate it, and I hope there will be another commission that suits you better.",
      suggestLabel: "Anyone you'd suggest?",
      suggestHelp: "If another artist comes to mind who would suit this space, I would be glad to hear their name. It is entirely optional.",
      suggestSave: "Send suggestion",
      suggestSaved: "Thank you, that is saved.",
    },
    errors: {
      required: "Please answer this question to continue.",
      fee1800: "Please enter your quote for the 1800 x 900, or choose No thanks if this is not for you.",
      amount: "Please enter an amount in dollars, using numbers only.",
      gst: "Please tell me how GST applies to these amounts.",
      tooLong: "That is a little over the limit. Please shorten it to continue.",
      closed: "This page has closed for responses. If you need more time, please email me.",
    },
  },

  thanks: {
    heading: "Thank you for your response",
    body: "Thank you for taking the time to send this through. Your quote and your answers are with me now, and you can come back and edit them until the closing date.",
    next: "After the closing date I will go through every response and put together a shortlist for the team at the Te Puke branch. I will let you know how it has gone in early to mid November, whether or not you are chosen.",
    partTwoWhy:
      "There is one more step, and it matters. The people who work in the branch will help decide who makes the piece on their wall, and they will get to know you through a short biography, a photo and some of your work, so please add those next.",
    partTwoButton: "Begin part two",
  },

  partTwo: {
    short: "Part two",
    title: "Part two: About you",
    summary:
      "A short biography, a photo and a few of your works, so the team at the Te Puke branch can get to know you. You can also choose to keep it as a Patronage profile.",
    /** Set a time (e.g. "15 min") to show a clock pill for Part two too. */
    duration: null as string | null,
    q: {
      photo: {
        label: "Photo of you",
        help: "A photo of you, ideally in your studio or with your work, so the team can put a face to the name. A phone photo is perfect.",
        button: "Choose a photo",
      },
      name: { label: "Name as you'd like it shown", help: "How you would like your name to appear to the staff." },
      location: { label: "Where you're based", help: "A town or city is plenty." },
      bio: { label: "Short biography", help: "Up to 150 words. Write it the way you would introduce yourself to someone in the room." },
      website: { label: "Website" },
      instagram: { label: "Instagram" },
      otherLinks: { label: "Other links" },
      works: {
        label: "Your works",
        help: "Add 4 to 8 works that show your range and give a sense of how you work. Choose images that look good on a phone, since many of the staff will see them there.",
      },
      staffPrompt: {
        label: "What would you like someone to feel standing in front of your work?",
        help: "Optional. A sentence or two in your own words is perfect, and it helps the team feel they know you.",
      },
      choice: { label: "Would you like to keep this as a Patronage profile?" },
      consent: {
        label: "Before you send",
        body: `By sending this part you agree to the following. The biography, photo, links and works you have added will be shown to the staff at the Rabobank Te Puke branch and to me, so that they can choose an artist. Your quote is seen only by me and by Mark at Rabobank, and I keep it as a record of this project.

You keep the copyright in everything you send, and your images are used only for this selection. If you choose to keep your profile, it becomes a Patronage profile that you can edit or delete at any time. If you choose not to, I will email you once the selection has finished to ask whether you would like to keep it, and if I do not hear back within 30 days I will delete it, along with your photo and works.

To see, correct or delete anything we hold about you, email {contactEmail}.`,
        tick: "I understand and agree",
      },
      keepEmail: { label: "Email for your sign-in link" },
    },
    worksCount: (n: number, min: number, max: number) => `${n} of ${min} to ${max}`,
    words: (n: number) => `${n} ${n === 1 ? "word" : "words"}`,
    choices: [
      ["keep", "Yes, keep this as my Patronage profile."],
      ["private_only", "Not now, use it only for the Rabobank selection."],
    ],
    work: {
      title: "Title",
      year: "Year",
      medium: "Medium",
      size: "Size",
      note: "A line about the work (optional)",
      add: "Add a work",
      remove: "Remove",
    },
    submit: "Send my profile",
    errors: {
      name: "Please tell me how you would like your name shown.",
      bio: "Please write a short biography, up to 150 words.",
      works: "Please add at least four works, and no more than eight.",
      choice: "Please choose one of the two options.",
      consent: "Please tick the box to continue.",
      email: "Please enter a valid email address.",
      upload: "That file could not be uploaded. Please try a JPG or PNG under 10 MB.",
      closed: "This page has closed for responses. If you need more time, please email me.",
    },
  },

  done: {
    heading: "Thank you, that is everything",
    body: "Thank you for taking the time to introduce yourself. The team at the Te Puke branch will see your profile alongside the others when they start choosing.",
    next: "I will be in touch in early to mid November, whether or not you are chosen. If you need to change anything before then, you can use the same link and edit your answers.",
    keepSent:
      "I have sent a sign-in link to your email so you can edit your Patronage profile whenever you like. It can take a minute to arrive, and it is worth checking your junk folder.",
  },

  saving: { saving: "Saving", saved: "Saved", offline: "You are offline. Your changes will save when you reconnect." },

  closed: {
    heading: "This page has closed",
    body: "Responses for this commission have closed, so the page is no longer taking changes. If you would still like to be considered, or you need a hand with something, please email me and I will see what is possible.",
  },

  keep: {
    heading: "Keep your Patronage profile",
    body: "The Rabobank selection has finished, and you can now choose to keep the profile you made as a Patronage profile. Keeping it means you can edit it and add to it, and be found by people commissioning art across Aotearoa.",
    button: "Keep my profile",
    done: "Your profile is kept, and you can edit it whenever you like.",
    viewProfile: "View my profile",
    wrongAccount: "This link belongs to a different account. Please sign in with the email address you used for the commission.",
  },

  followup: {
    heading: "Would you like to keep your profile?",
    keepButton: "Keep my profile",
    deleteButton: "Delete my profile",
    confirmKeep: "Thank you. Your profile is kept, and I have sent a sign-in link so you can edit it.",
    confirmDelete: "Are you sure? This removes your biography, photo and works from Patronage, and it cannot be undone.",
    deleted: "Your profile has been deleted. Thank you for taking part.",
  },

  /** Fill-ins: {firstName}, {keepLink}, {deleteLink}, {deleteDate}, {signInLink}. The sign-off is added by the code. */
  email: {
    followupSubject: "Your Rabobank Te Puke profile: keep it or delete it?",
    followupBody: `Kia ora {firstName},

Thank you again for taking part in the Rabobank Te Puke commission. The selection has now finished, and I wanted to ask about the profile you made for the staff at the branch, because it is still stored with me and I do not want to keep it without checking.

You have two options. You can keep it as a Patronage profile, which you can edit whenever you like, or you can have it deleted along with your photo and works. If I do not hear from you by {deleteDate}, I will delete it.

Keep my profile: {keepLink}
Delete my profile: {deleteLink}`,
    reminderSubject: "A reminder about your Rabobank Te Puke profile",
    reminderBody: `Kia ora {firstName},

This is a quick reminder that I will delete your Rabobank Te Puke profile on {deleteDate} unless you would like to keep it. It takes one click either way.

Keep my profile: {keepLink}
Delete my profile: {deleteLink}`,
    keepSubject: "Your Patronage sign-in link",
    keepBody: `Kia ora {firstName},

Here is your sign-in link, which lets you edit your Patronage profile: {signInLink}. It works once and expires after a short time, so if it has stopped working you can ask for a new one from the sign-in page.`,
    signoff: "Blake Aitken, Patronage",
  },
} as const;
