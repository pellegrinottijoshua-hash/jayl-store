---
name: sync-main
description: Use before ANY push in jayl-store, or when a push is rejected non-fast-forward, or when pull fails with "cannot pull with rebase: You have unstaged changes". The admin panel commits directly to remote main, so local is chronically behind.
---

# Sync Main

Root cause: the /admin panel writes products/orders/reviews by committing to **remote** main via the GitHub API while local sessions hold uncommitted changes. Historically this produced 30× "cannot pull with rebase: You have unstaged changes" and 17× rejected non-fast-forward pushes. This is the fix, every time.

## Safe sequence

```bash
git status --short                # know what's dirty before touching anything
git pull --rebase --autostash origin main
```

`--autostash` stashes dirty files, rebases, and restores them — this alone prevents both historical failure modes.

- **If the rebase hits conflicts:** STOP. `git status` to list conflicted files, report them to the user with a proposed resolution. Never resolve conflicts in `src/data/admin-products.js` by picking wholesale "ours" — the remote side contains admin saves (real product edits) that must not be lost. Merge both sides or abort (`git rebase --abort`) and ask.
- **If the autostash pop conflicts:** the stash is preserved; resolve manually, report.

```bash
git push origin main
git status --short                # confirm clean / expected leftovers only
```

## Rules
- Never `git push --force` on main. The remote history contains admin-panel commits that exist nowhere else.
- Commit only the files belonging to the current task — the working tree often has unrelated modified files (`public/sitemap.xml` is generated: never commit it).
- After the push, run /verify-live before telling the user anything is done.
