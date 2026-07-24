# Trust Boundary Release Gate

This release must keep the interface and durable record aligned.

## Required guarantees

- A submitted Role Sprint is a frozen review version.
- Revising submitted work removes the old pending evidence snapshot first.
- Approval shows the exact claim and source excerpt being approved.
- User-edited output copy is labeled as not checked by Career Forge.
- Application stage changes are confirmable, undoable, and historically traceable.
- Past interviews ask for an outcome instead of recommending more preparation.
- Clearing a date or choosing no target/baseline is stored exactly as selected.

## Automated gate

The pull request must pass typecheck, lint, the full unit chain, browser acceptance, private acceptance, commerce journey, backup/recovery, production build, and Vercel preview before merge.
