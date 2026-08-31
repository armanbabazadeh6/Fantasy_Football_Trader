# Ticket 002: README and docs cleanup (stop-slop pass)

**Priority:** Medium
**Scope:** README.md, ticket docs
**Skill:** Load `stop-slop` before starting this ticket

## Goal

The README has been appended to across many feature pushes and reads like a changelog wearing a trench coat. Rewrite it as a clean, confident project page. Remove AI writing patterns, redundant emphasis, and feature-list bloat.

## Tasks

- [ ] Load the `stop-slop` skill and review README.md against every rule it defines
- [ ] Rewrite the intro: one paragraph that says what this is, who it's for, and what makes it different
- [ ] Restructure features into a tight table with concrete outcomes, not marketing adjectives
- [ ] Cut every phrase that sounds like filler ("battle-tested", "seamlessly", "powerful", em-dash chains, rule-of-three lists)
- [ ] Verify every command in the quick start actually works from a fresh clone (npm install, smoke, dev)
- [ ] Verify the env table matches `.env.example` exactly
- [ ] Update the project structure tree to match the current file layout (it is stale)
- [ ] Replace vague claims with numbers where we have them (player counts, news source counts, audit results)
- [ ] Roadmap section: keep only items we genuinely plan to build; delete the rest
- [ ] Proofread the disclaimer and data source credits for accuracy

## Acceptance criteria

- A new visitor understands the project in under 30 seconds
- No sentence survives that an AI detector would flag
- Everything documented is true (commands run, paths exist)
- Under 200 lines total
