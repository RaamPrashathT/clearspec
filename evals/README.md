# clearspec evals

Not loaded by the skill, and never copied into installs (the personas hold hidden requirements).

1. **Check script regression.** `pnpm test` (or `node scripts/check-fixtures.mjs`) runs the check script on every fixture in `fixtures/`; each must exit 0. CI runs it on every push.
2. **Persona runs.** `node evals/run-persona.mjs <case id> --arm both` runs a case from `evals.json` against a fresh copy of its test project, with the skill (`skill` arm) and with no skill (`none` arm). A persona session answers from `personas/<file>.md`; a judge scores hidden-requirement recall. Results go to `test-projects/_runs/`.
   - `--max-turns 40`, `--budget 20` (USD, per arm) cap a run.
   - `--skill-dir evals/baselines/baseline-skill-v2` measures the previous version (decisions.md + roadmap.md layout); `baseline-skill-v1` is the one before that. The runner installs each version under the name in its SKILL.md, so the old `/spec-it` versions still run.
3. **Human review.** Open `clearspec/<name>/mockups/index.html` and write specific feedback ("dashboard: settle-up button competes with add expense"), not "looks bad".

## Hidden requirements

Each persona lists the requirements a good spec must contain. Items marked `(twist)` go against the usual default for the domain, so prior-art research alone won't produce them; only the right question will. The runner reports recall three ways: overall, standard, and twist. Watch twist recall: it's the part that shows whether the interview works.

## Cases

| Id | Case | Test project | Type |
|---|---|---|---|
| 1 | ui-medium-roommates | 01-react-tailwind | UI |
| 2 | api-small-webhooks | 03-express-api | API |
| 3 | large-with-contradictions | 02-empty | UI, large |
| 4 | cli-small-branches | 04-node-cli | CLI |
| 5 | mixed-medium-bookings | 06-mixed | UI + API |
