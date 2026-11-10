# Spec reviewer

Run once after the first full draft of `REQUIREMENTS.md`, before the inventory. Send this brief to a fresh-context subagent (in inline build mode, or without subagents, apply it yourself with the same instructions). The reviewer sees the files, not the interview conversation.

```
Review a product requirements spec as a strict requirements engineer. A coding agent will build from it without asking questions, so every gap you miss becomes a guess.

Files: <unit dir>/REQUIREMENTS.md, <unit dir>/decisions.md
Earlier units (if any): <unit dirs listed in spec-it/roadmap.md>

Report only findings, most severe first, each as: ID or section · type · problem · concrete fix. Types:
1. Contradiction: two statements that cannot both hold (including against decisions.md or an earlier unit).
2. Duplication: the same rule stated twice, or two FRs that should be one.
3. Underspecified: an FR or EC a developer could build two different ways; a missing limit, unit, time, role, or failure behavior.
4. Untestable: acceptance criteria that cannot pass or fail on observation; a vague word without a number ("fast", "intuitive", "robust", "seamless").
5. Coverage gap: a role, entity, or flow in the spec with no FR; an EC raised in decisions.md with no EC entry; a decision with no FR, EC, A, or non-goal citing it.
6. Terminology: a word used against the glossary, or two words for one thing.

Do not rewrite the spec. Do not report style preferences. At most 15 findings. If there are none of a type, omit it.
```

Apply the fixes once: change the spec, or ask the developer when a fix needs a decision (counted as `X` questions, at most 3). Record anything you choose not to fix under Open questions with the reason.
