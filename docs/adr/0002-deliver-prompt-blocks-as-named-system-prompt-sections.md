# 2. Deliver prompt blocks as named system-prompt sections

Date: 2026-10-30

## Status

Accepted

Clarified by [3. Derive the skill-router ledger from the filesystem](0003-derive-the-skill-router-ledger-from-the-filesystem.md)

Related from [4. Vendor the rules injector into this repository](0004-vendor-the-rules-injector-into-this-repository.md)

## Context

Several extensions contribute text to the system prompt: an environment block, a skill
router ledger, and the harness rules. The runtime offers two delivery shapes. A handler may
return a replacement prompt, which sets a forced-prompt value; or it may write a named entry
into the prompt sections, which the runtime merges, validates, and fences.

The two shapes are not interchangeable. Once any handler returns a replacement prompt, the
runtime renders that string and skips section assembly entirely. Extensions that ran earlier
survive only because the forcing handler copied the prompt it saw; every section written
afterwards is silently discarded while remaining present in the session transcript. A
reported symptom was 14 KB of rules present in the transcript and absent from the request,
with no error anywhere.

A second cost is fidelity: a forced prompt is opaque, so the transcript's sections and the
bytes the model received disagree. Debugging a prompt problem from a session file becomes
unreliable exactly when it matters.

## Decision

Every extension contributes prompt text through the named-section seam, and no handler
returns a replacement prompt. One section key has exactly one owner.

### Considered Options

- Replacement prompt strings (status quo)
  - Pros: simple, no coordination, works for a single extension.
  - Cons: silently erases later sections; order-dependent; last writer wins; transcript
    disagrees with the request.
  - Why not: this is the failure being recorded.
- Merge all prompt-contributing extensions into one owner
  - Pros: central ordering and budgeting.
  - Cons: does not fix the class — any third-party handler that returns a replacement prompt
    still erases everything; couples unrelated lifecycles.
  - Why not: fixes the symptom's location, not its mechanism.
- Named sections (chosen).

## Consequences

Section contributions become order-independent and individually visible in the transcript,
and a failure inside one block degrades that block rather than the whole prompt. Each owner
must not re-emit its own outer fence, because the runtime supplies it, and empty bodies are
dropped.

The invariant is contractual rather than type-enforced: the result type still permits a
replacement prompt. It is therefore pinned by a composition test that loads the real
contributors, asserts one fence per owner, and asserts that no handler returns a replacement
prompt. If a forcing handler ever returns, every section disappears together — that test is
the only signal, so it must exercise real extensions rather than synthetic sections.

Section keys must be disjoint and match the runtime's lowercase name rule. Disjointness is
asserted by the same test rather than by a shared constant module.
