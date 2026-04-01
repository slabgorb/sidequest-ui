---
story_id: "14-8"
jira_key: ""
epic: "14"
workflow: "trivial"
---
# Story 14-8: Sound slider labels — add descriptive labels to all audio control sliders

## Story Details
- **ID:** 14-8
- **Epic:** 14 (Multiplayer Session UX — Spawn, Visibility, Text Tuning, and Chargen Polish)
- **Workflow:** trivial
- **Points:** 1
- **Priority:** p2
- **Stack Parent:** none

## Description

Add visible labels to all audio sliders (Music, SFX, Voice). Labels should be visible without hovering. Currently the channel name only appears in aria-label, not as visible text.

## Acceptance Criteria

1. Each audio slider has a visible text label (Music, SFX, Voice)
2. Labels are visible without hovering or interacting
3. Existing aria-labels remain for accessibility
4. Visual style is consistent with the existing audio panel aesthetic

## Implementation Approach

**UI side (sidequest-ui):**
- In `AudioStatus.tsx`, add a visible `<span>` with the capitalized channel name next to each slider
- Style consistently with the panel's muted-foreground aesthetic
- Existing tests in `AudioStatus.test.tsx` may need updates for the new label elements

## Key References
- sidequest-ui/src/components/AudioStatus.tsx (lines 127-158)
- sidequest-ui/src/components/__tests__/AudioStatus.test.tsx

## Workflow Tracking
**Workflow:** trivial
**Phase:** setup
**Phase Started:** 2026-03-31T10:00:00Z

### Phase History
| Phase | Started | Ended | Duration |
|-------|---------|-------|----------|
| setup | 2026-03-31T10:00:00Z | - | - |

## Delivery Findings

Agents record upstream observations discovered during their phase.
Each finding is one list item. Use "No upstream findings" if none.

**Types:** Gap, Conflict, Question, Improvement
**Urgency:** blocking, non-blocking

<!-- Agents: append findings below this line. Do not edit other agents' entries. -->

No upstream findings.

## Design Deviations

Agents log spec deviations as they happen — not after the fact.
Each entry: what was changed, what the spec said, and why.

<!-- Agents: append deviations below this line. Do not edit other agents' entries. -->

None yet.

## Sm Assessment

**Story 14-8** is a 1-point p2 trivial story. Pure UI fix — add visible text labels to audio sliders in AudioStatus.tsx. No API changes. Trivial workflow, routing to Dev (Yoda) for implementation.
