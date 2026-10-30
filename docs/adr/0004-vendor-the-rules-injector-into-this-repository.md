# 4. Vendor the rules injector into this repository

Date: 2026-10-30

## Status

Accepted

Relates to [2. Deliver prompt blocks as named system-prompt sections](0002-deliver-prompt-blocks-as-named-system-prompt-sections.md)

## Context

The harness rules were delivered by a separately published extension package. That extension
was already correct: it wrote a named prompt section and never returned a replacement prompt.
The problem was distribution, not behavior. Because it arrived through a package channel, the
rules block could be absent for reasons invisible from this repository, and debugging a
missing rules block required reading two codebases. When the package was uninstalled, every
session silently lost its rules with nothing in this repository to explain why.

Two display conventions already existed here: one obvious top-level file per prompt block
(`env-injector.ts`, `skill-router-injector.ts`). A third owner living outside the repository
broke that convention and with it the ability to review prompt composition in one place.

## Decision

Vendor the rules injector into this repository as `rules-injector.ts`, byte-identical to its
source of truth apart from the relative imports that point at its helpers. The scanner,
checksum cache, and rule lifecycle stay as separate modules in an inert `rules/`
subdirectory. The published package is retired, and the repository records that retirement.

### Considered Options

- Keep the npm package
  - Pros: versioned, independently releasable, reusable in other repositories.
  - Cons: a second distribution channel for one prompt block; cross-repository debugging;
    an uninstall removes the block with no signal here.
  - Why not: the goal was one visible, reviewable home for prompt composition.
- Merge the rules feature into the extensions directory as one file
  - Pros: literal consistency with the two single-file injectors.
  - Cons: roughly 1 200 lines mixing three independent invariants — frontmatter scanning,
    checksum gating, and path matching — in one review unit.
  - Why not: review quality and failure isolation outweigh file-count consistency.
- Vendored entry plus inert helper directory (chosen).

## Consequences

Installing the harness no longer depends on a package for prompt composition: the extensions
directory is the home, and loading it is a symlink with no build step and no runtime
dependencies. All three prompt owners are now reviewed and tested together, and a composition
test exercises the real three injectors rather than a synthetic section.

The retirement is recorded next to the code, with the diagnostic that a session lacking a
rules block means a load failure rather than a reason to reinstall the package.

New files under the pi config tree are hidden by the repository's ignore rule, so they must be
staged explicitly; a plain status check will not reveal them.

A parity test compares the vendored entry against the development repository, read-only, and
skips loudly when that checkout is absent. The residual risk is the hand-written runtime type
stub: it is checked against the vendored code but not against the installed runtime, so a
runtime change can drift silently until a follow-up cross-check exists.
