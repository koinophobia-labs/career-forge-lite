# Final Durability Gate

Career Forge must preserve the user's career history across ordinary saves, browser tabs, backups, and restores.

## Required guarantees

- Backup export and import preserve application activity timestamps, stage history, and prior interview dates.
- Explicit status changes use one transition engine across the job workspace and application tracker.
- Undo restores only stage-related fields and cannot overwrite newer cross-tab status changes.
- Completed interviews request an outcome.
- Unscheduled next rounds request a date instead of restarting interview practice.
- Backup reminders recognize substantial Role Sprint and approved-evidence work without nagging lightweight early users.

## Automated gate

The pull request must pass typecheck, lint, the complete regression chain, desktop and mobile browser acceptance, private acceptance, the test-commerce journey, backup and recovery proof, production build, and Vercel preview before merge.
