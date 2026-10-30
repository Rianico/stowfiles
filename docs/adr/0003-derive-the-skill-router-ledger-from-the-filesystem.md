# 3. Derive the skill-router ledger from the filesystem

Date: 2026-10-30

## Status

Accepted

Clarifies [2. Deliver prompt blocks as named system-prompt sections](0002-deliver-prompt-blocks-as-named-system-prompt-sections.md)

## Context

Router skills manage hidden subskills. The runtime does not recurse into a `subskills/`
directory, so the ledger injected into the prompt is the only discovery path a model has.
That made the ledger's accuracy load-bearing.

The ledger used to be transcribed from a hand-maintained `argument-hint` field on the router
skill. It drifted from disk in both directions: a router that carried a manage marker but no
hint was dropped entirely, making all five of its subskills unreachable; a subskill that
existed on disk was missing; and a name that existed nowhere was injected as if it were
real. A router cap of five additionally hid the sixth router once derivation found them all,
which contradicted the ledger's purpose.

## Decision

Derive the ledger from the directory layout: a loaded skill is a router when its adjacent
`subskills/` directory contains at least one child directory holding its own `SKILL.md`. A
leaf's label is its directory name; its description is that leaf's own `description`
frontmatter, folded to one line. Routers and leaves sort by name, and there is no cap. A
skill the runtime hides from the model is not a router: its subskills are hidden with it,
decided from the parent's flag before any directory is read.

### Considered Options

- Keep the hand-maintained hint ledger
  - Pros: short lines, roughly a third of the injected bytes.
  - Cons: silent drift in both directions; a router without the hint disappears with no
    warning; phantom entries are injected; unreachable subskills go unnoticed.
  - Why not: the ledger's only value is accuracy, and its source was not authoritative.
- Derive from disk but keep the router cap
  - Pros: bounded section size.
  - Cons: at five routers the live tree already hit the cap, so the next router would hide
    behind a truncation note; silent omission is the exact failure being removed.
  - Why not: rejection of the cap is part of this decision.
- Derive from disk with truncated descriptions
  - Pros: recovers most of the size.
  - Cons: the description is the routing signal; truncation removes the cue that makes
    selection work.
  - Why not: correctness was preferred over size, with the cost recorded below.
- Derive from disk with verbatim leaf descriptions (chosen).

## Consequences

The ledger cannot drift from disk: adding `subskills/<name>/SKILL.md` is the only step needed
to make a subskill discoverable, and a nonexistent entry can no longer appear. Symlinked leaf
directories and symlinked `SKILL.md` files are supported; a child that cannot be resolved is
skipped with a warning rather than silently. A leaf with an unreadable description is listed
by name.

Visibility follows the parent, not the leaf. The runtime withholds a skill from the model
when it declares `disable-model-invocation`, yet still hands it to prompt-contributing
extensions, so the filter has to live here. Subskill files are not loaded skills and carry
no visibility flag of their own; a hidden parent therefore suppresses its whole subtree with
no warning, because the hiding is deliberate. Observed on the live tree: a hidden router with
six subskills disappeared, leaving four routers and 29 leaves at 7 960 bytes, down from
9 335.

Before the visibility filter, the section had grown from 3 683 to 9 335 bytes because
verbatim leaf descriptions replace curated one-liners. That cost is accepted and recorded
here so it is not "fixed" by reintroducing a hand-maintained summary.

Router `argument-hint` and `metadata.manage` become dead inputs for injection. Skill files
are left untouched, so a future reader must not treat the hint as authoritative.

Load-bearing assumption: subskills live in a `subskills/` directory adjacent to the router's
`SKILL.md`, and each leaf has its own `SKILL.md`. A different layout requires a new decision.
