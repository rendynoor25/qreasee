# Recipe review register (v4.2)

Every numeric default in a recipe is a **starter value**, not a standard. A senior
architect or the studio must review each one before it is relied on. This file is
the tracking table the v4.2 addendum asks for.

**Rule:** where a row stands for a regulated facility (egress, accessibility,
sanitary ratios), the value must be left empty with `needs-input` and a note
"supply source", unless the owner supplies a document. **No invented citations.**

Legend for `basis`: `user` (asked in the wizard), `typical` (starter, review),
`studio` (from the studio's own past project), `client`, `regulation` (sourced).

| Recipe | Parameter | Starter value | basis | Reviewer | Source | Date |
|---|---|---|---|---|---|---|
| house | Bedrooms | 3 | user | _pending_ | — | — |
| house | Bathrooms | 2 | user | _pending_ | — | — |
| house | Area per bedroom | 12 m² | typical | _pending_ | — | — |
| house | Living | 20 m² | typical | _pending_ | — | — |
| house | Dining | 12 m² | typical | _pending_ | — | — |
| house | Kitchen | 9 m² | typical | _pending_ | — | — |
| house | Carport | 15 m² | typical | _pending_ | — | — |
| house | Service / laundry | 6 m² | typical | _pending_ | — | — |
| dormitory | Beds in total | 120 | user | _pending_ | — | — |
| dormitory | Beds per room | 6 | typical | _pending_ | — | — |
| dormitory | Area per bed | 3.0 m² | typical | _pending_ | — | — |
| dormitory | Beds per bathroom | 8 | typical | _pending_ | — | — |
| dormitory | Common room | 40 m² | typical | _pending_ | — | — |
| dormitory | Office / staff | 16 m² | typical | _pending_ | — | — |
| cafe | Seats | 80 | user | _pending_ | — | — |
| cafe | Area per seat | 1.5 m² | typical | _pending_ | — | — |
| cafe | Kitchen | 18 m² | typical | _pending_ | — | — |
| cafe | Bar / counter | 10 m² | typical | _pending_ | — | — |
| cafe | Storage | 6 m² | typical | _pending_ | — | — |
| school | Classrooms | 6 | user | _pending_ | — | — |
| school | Area per classroom | 56 m² | typical | _pending_ | — | — |
| school | Staff room | 32 m² | typical | _pending_ | — | — |
| school | Library | 40 m² | typical | _pending_ | — | — |
| school | Canteen | 40 m² | typical | _pending_ | — | — |

## Regulated rows left empty on purpose

None yet. When a regulation value is needed (e.g. minimum sanitary fixtures,
egress widths), add a row here with `basis: regulation` **and** a source document,
or leave the recipe value empty with a "supply source" note.

## How to review

1. Open each recipe JSON in `packages/concept/src/recipes/data/`.
2. Check each parameter against the studio's real projects (or the owner's data).
3. Replace the value and set `basis` to `studio` / `client` / `regulation`.
4. Fill this table (reviewer, source, date).
5. Recipe version increments; existing projects keep their stored numbers.
