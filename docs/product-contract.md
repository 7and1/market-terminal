# TrendAnalysis.ai Product Contract

## Positioning

TrendAnalysis.ai is not a terminal and not a bundle of tool pages.

The product promise is:

> A user asks why a market is moving, and the system turns that query into an evidence-backed market explanation that can be published, cited, and revisited later.

## Surface Roles

| Surface | Role | Audience | Indexing |
| --- | --- | --- | --- |
| `/` | Landing page that catches the question and routes the user into the right surface | Public | Indexed |
| `/terminal` | Private research workspace for runs, trace, evidence inspection, and ad hoc analysis | Owner/operator | Noindex |
| `/report/[slug]` | Public explanation page for one publishable head | Public | Indexed only for current publishable heads |
| `/asset/[key]` | Public asset hub for current baseline plus historical archive | Public | Indexed |
| `/trending` | Public feed that starts with fresh reports and then pivots into asset hubs | Public | Indexed |
| `/tools/*` | Supporting pages that explain or demo one subsystem | Supporting audience only | Noindex |
| `/dashboard` + `/api/monitors*` | Operator control plane for sessions, monitors, and replay | Operator | Noindex / auth-gated |

## Query Decision Model

Every market query should resolve into exactly one of four outcomes:

| Decision | Meaning | Example |
| --- | --- | --- |
| `reject` | Off-domain request that does not belong in market research | `What is the weather tomorrow in New York?` |
| `run_private` | Valid market query, but outside the canonical public head model | `Gold vs Ethereum today` |
| `reuse` / public asset hub | Broad canonical asset or subject that should land on the asset hub first | `BTC`, `Gold`, `Fed`, `CPI` |
| `reuse` / public report or `run` with public report head | Canonical comparison or narrow publishable public head | `Gold vs Bitcoin`, `Rates vs Tech`, `How are yields affecting tech?` |

Notes:

- Canonical broad subjects default to `asset_hub`.
- Curated comparison heads default to `report`.
- Publish never upgrades a private-only query into a public report.
- Terminal may still run private-only queries, but publish must reject them clearly.

## URL Contract

The routing contract for default locale `en` is semantic parity, not duplicate product meaning.

| URL | Contract |
| --- | --- |
| `/` and `/{locale}` | Same landing meaning |
| `/terminal` and `/{locale}/terminal` | Same private workspace meaning |
| `/asset`, `/asset/[key]` and locale-prefixed variants | Same public asset hub meaning |
| `/report/[slug]` and locale-prefixed variants | Same public report meaning |
| `/tools` and `/tools/*` | Reachable support pages, but not part of primary SEO strategy |
| Historical `/report/[slug]` | Accessible by direct URL, canonicalized to current head when superseded |

Routing rules enforced by the app:

- Root-segment routes rewrite to the default locale internally, so `/terminal` and `/en/terminal` resolve to the same page type.
- Locale switching must preserve the semantic pathname. `/en/terminal` must never become `/zh/en/terminal`.
- The root app must not hard-redirect the user to `/en`, because canonical English should remain unprefixed.

## Information Architecture

Primary path:

1. Landing captures the question.
2. Query resolution decides reject, private run, asset hub reuse, or report reuse.
3. Terminal executes only when a private run or fresh run is justified.
4. Publish upgrades only canonical public heads.
5. Report and asset hub become the long-lived public memory.

Supporting path:

1. Trending exposes fresh reports first.
2. Asset hubs provide current baseline plus archive.
3. Tools remain supporting documentation or exploratory entry points.

Control-plane path:

1. Sessions, trace, replay, publish, and monitors stay private.
2. Operator-only monitor APIs are protected by `OPERATOR_TOKEN`.

## Acceptance Gates

### P0

- `/terminal` and `/en/terminal` resolve to the same private workspace.
- Query resolution consistently chooses `reject`, `private`, `asset_hub`, or `report`.
- Non-owners cannot read another session trace or publish another session.
- Monitor APIs are not publicly writable.

### P1

- Landing has one primary CTA: ask why a market is moving.
- Report, asset hub, and trending each have a distinct role.
- Tools do not compete with the primary product narrative.

### P2

- Public pages read through a shared projection layer instead of hand-built page-specific database joins.
- Canonical, alternate, robots, sitemap, and historical report behavior are consistent.
- Preview validation can check `/api/health?probe=1` with operator auth, query resolution, and optionally `run -> publish -> report`.
