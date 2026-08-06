/**
 * The occupation-template layer is RETIRED from the launch path.
 *
 * Why
 * ---
 * Templates keyed to an occupation profile ("Served guests by…", "Monitored
 * camera feeds.", "Supported clients with personal care.") were gated by
 * lexical tests: a trigger regex, later a second grounding test on the phrase
 * itself. Five review rounds established that lexical gating cannot decide the
 * one question that matters — WHO performed the action:
 *
 *   "The night crew kept the care notes for me."      -> "Kept care notes."
 *   "A senior cashier processed the payments while I bagged."
 *                                                     -> "Processed payments."
 *   "A contracted team monitored the camera feeds from off site."
 *                                                     -> "Monitored camera feeds."
 *
 * 13 of 15 third-party attribution fixtures fabricated. The gates cannot
 * disagree with each other, because neither models subject, polarity, tense or
 * modality — when the user's words ARE the template's words but belong to
 * someone else, both tests pass. Tightening them far enough to stop that made
 * 44 of 111 clause pairs unreachable and cut realistic output from 16 composed
 * bullets to 2, i.e. the layer only restated words the user had already
 * written. Both settings are wrong, which is the signal that the mechanism is
 * wrong.
 *
 * Doing this properly needs subject resolution, coreference, clause relations,
 * polarity, modality and ownership — a new subsystem, not closure work.
 *
 * What replaces it
 * ----------------
 * Nothing, on the launch path. Career Forge already does the safer thing
 * underneath: clean the user's own evidence into résumé voice, select and
 * reorder it, combine statements only where subject and ownership are already
 * explicit, and shorten or format without adding activities.
 *
 * Occupation knowledge survives as an INTERVIEWER, not a claim factory — it
 * may ask "Security roles often involve incident documentation. Did you
 * personally write incident reports?" It may never quietly become "Prepared
 * incident reports."
 *
 * The code is preserved rather than deleted so the research direction keeps
 * its history. Turning this on outside a research context reopens every
 * fabrication class listed above.
 */
/**
 * Two independent conditions, both of which must hold. Default-off is not
 * enough on its own: NEXT_PUBLIC_* values are inlined at BUILD time, so a
 * stray variable in a deployment environment would bake the layer into a
 * production bundle with nothing at runtime able to stop it. The NODE_ENV
 * check makes a production build refuse regardless of how the variable is set.
 *
 * Consequence, stated so it cannot surprise anyone: the research flag has NO
 * effect in a production build. Research work runs in development or test.
 */
export const OCCUPATION_TEMPLATES_ENABLED =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_ENABLE_OCCUPATION_TEMPLATES === "research";

/** Explicit name for the launch posture, for assertions and tests. */
export const OCCUPATION_TEMPLATES_RETIRED = !OCCUPATION_TEMPLATES_ENABLED;
