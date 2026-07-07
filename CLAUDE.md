# Project Notes

## Changelog rule

This project keeps [CHANGELOG.md](CHANGELOG.md) as the source of truth for "what changed last."

- After finishing any code change (feature, fix, refactor), add one line to the **Unreleased** section at the top of `CHANGELOG.md`, formatted as:
  `- YYYY-MM-DD — <type>: <short description>`
- Update the `**Last updated: YYYY-MM-DD**` line at the top of the file to today's date.
- Do this automatically, without being asked, as part of finishing the task — don't wait for the user to request it.
