# Blue Projects Horizon Ideas — prototype

A local, interactive first exploration of the Ideas pillar. Open `index.html` in a modern browser or serve this folder with any static server. No install or build is required.

## Information architecture

- **Discover ideas:** searchable cards with business dimension, theme and stage filters. “My ideas” shows locally submitted records; review and promoted views expose stages.
- **Idea detail:** problem, optional solution, recognition, discussion, feedback and activity. Stream lead controls demonstrate feedback, status changes, rerouting, linking a related item and explicit promotion with a handoff note. A merge is represented as a reference, not an automatic transfer or deletion of records.
- **Horizon Initiatives:** promotion records a local handoff note. A separate DT lead pickup creates a linked local initiative in the accompanying Pipeline; no external application is contacted and no investment is approved. Horizon Impact is a future pillar.

## Data and boundaries

Seed ideas, contributors, comments, counts, statuses and feedback are illustrative. They adapt opportunity themes visible in the referenced conversation; the original six-item pipeline JSON and complete fourteen descriptions were not accessible, so this is not a faithful or complete import. They do not establish real approvals, outcomes, savings or attribution. New submissions, thumbs-ups, comments and reviews are saved in browser `localStorage`; they are private to that browser profile and can be cleared by clearing site data. Thumbs-ups can be toggled once in this browser; no popularity-based prioritization exists. Kudos is reserved for impact and is not implemented or awarded in this prototype. Previous local Kudos reactions are retained in the stored records but are not converted to thumbs-ups or impact awards.

The prototype has no backend, shared data, authentication, SSO, real identities, enforced permissions, audit-grade history, notifications, attachment storage, security controls or integration with the existing Claude artifact. Anyone using the prototype can operate its review controls. Production would require BP-approved hosting, SSO and server-enforced roles, a shared database, access and data-retention policies, secure evidence handling, reliable audit history, moderation, accessibility and security review, and an agreed API/handoff contract.

The existing Claude Idea to Business Case artifact is separate, currently available only to the user and Neal, and was estimated to require about one focused week to operationalize. It is not integrated here.

## Integrated local Pipeline prototype

Open `pipeline.html` through the Ideas navigation. In an idea's detail, **Pick up for business case** records an owner and note, creates a linked initiative and marks the idea **In Business Case**. Links return to the source idea. The existing pipeline's Gate 0 remains undecided; pickup permits work on a business case without recording approval. Linked initiatives cannot be deleted in this prototype, to protect provenance. The Pipeline contains no imported Claude data by default; illustrative source ideas create illustrative initiatives. The two apps use localStorage in the same browser and origin. For reliable sharing between pages, serve the folder on the same local HTTP origin; file URL storage behavior varies by browser. This does not connect to the existing Claude artifact or a shared database. Role enforcement, atomic transactions, concurrency controls, audit, import reconciliation and secure multi-user storage are production work.
