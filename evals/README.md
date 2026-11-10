# clearspec evals

Not loaded by the skill, and never copied into installs (the personas hold hidden requirements).

1. **Check script regression.** Each must exit 0:
   ```bash
   node plugins/clearspec/skills/clearspec/scripts/check.mjs evals/fixtures/ui/clearspec/1-splitly
   node plugins/clearspec/skills/clearspec/scripts/check.mjs evals/fixtures/cli/clearspec/1-branch-tool
   ```
2. **Persona runs.** `node evals/run-persona.mjs <case id> --arm both` runs a case from `evals.json` in a fresh clone of its test project, with the skill and without it. A persona session answers from `personas/<file>.md`; a judge scores hidden-requirement recall. Results go to `test-projects/_runs/`.
   - `--max-turns 40`, `--budget 20` (USD, per arm) cap a run.
   - `--skill-dir evals/baselines/baseline-skill-v2` measures the previous version (decisions.md + roadmap.md layout); `baseline-skill-v1` is the one before that.
3. **Human review.** Open `clearspec/<unit>/mockups/index.html` and write specific feedback ("dashboard: settle-up button competes with add expense"), not "looks bad".
