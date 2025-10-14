# Syncing `codex/add-biometrics-uploader-tool-5xajaa`

When the remote branch moves forward you may see `git pull` fail with
`Your local changes to prisma/schema.prisma would be overwritten by merge.`
The safest way to recover is to make sure your local edits are saved before
bringing down the new commit.

## Option A – Keep your edits (recommended)

1. Inspect the working tree and review what you plan to keep:
   ```bash
   git status
   git add -p prisma/schema.prisma
   git add -p app/(dashboard)/[departmentId]/(routes)/(frontend)/view/components/gallery/index.tsx
   git add -p utils/copy-utils.ts
   ```
2. Commit the WIP snapshot locally:
   ```bash
   git commit -m "WIP: local edits before pulling origin"
   ```
3. Rebase onto the upstream branch so history stays linear:
   ```bash
   git pull --rebase
   # fix any conflicts if prompted, then
   git add <resolved-file>
   git rebase --continue
   ```
4. Regenerate the Prisma client if the schema changed:
   ```bash
   npx prisma generate
   ```

## Option B – Temporarily shelve your edits

1. Stash everything, including untracked files:
   ```bash
   git stash push -u -m "pre-pull stash"
   ```
2. Fast-forward to the remote HEAD:
   ```bash
   git pull --ff-only
   ```
3. Reapply the stash and resolve any conflicts:
   ```bash
   git stash pop
   # resolve conflicts if needed, then
   git add <resolved-file>
   git commit
   ```
4. Finish by regenerating Prisma:
   ```bash
   npx prisma generate
   ```

## Sanity checks

After either path, verify the branch tip and working tree:
```bash
git log --oneline --decorate -n 5
git status
```

> 💡 Tip: create a one-off backup branch before starting if you want an extra
> safety net: `git branch backup/local-before-pull`.
