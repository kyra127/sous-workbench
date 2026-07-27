# SOUS Workbench — Product Direction

## Primary prototype

- The canonical local prototype is `http://127.0.0.1:8124/`.
- Continue from `workbench-v5.js` and `workbench-v5.css`.
- Do not replace this product with the separate 8130 desktop SaaS experiment.

## Product definition

SOUS is a lightweight AI operations workbench for solo operators and very small businesses. It uses one shared operating backbone, then adapts terminology, sample data, execution workflows, and AI recommendations to the selected business type.

## Onboarding model

1. Account/business identity
2. Primary business type
3. Operating method: channels, fulfillment, capabilities
4. Configuration summary

Business type provides editable defaults; it must not lock the user into a rigid industry template.

## Current business types

- Bakery and desserts
- Floristry
- Private kitchen and food
- Handmade products
- Custom gifts
- Other operations

Do not remove or merge these options without an explicit user decision.

## Shared product capabilities

- AI-assisted intake from customer messages
- Orders and priority handling
- Catalog/menu/project data
- Materials, preparation, or execution planning
- Content generation
- Revenue and operating summaries
- Business profile editing and data export

Industry differences should be expressed through labels, defaults, sample catalogs, BOM terminology, fulfillment, and execution language—not separate products.

## AI boundary

- AI: understand, summarize, draft, and generate.
- Rules: totals, margin, stock/prep math, status, dates, and persistence.
- Human: confirm orders, correct fields, set prices, and make final operating decisions.

## Visual direction

- Mobile-first 393px app surface
- Warm cream base with restrained gold accent
- Editorial serif headings, clear sans-serif UI text
- Soft translucent surfaces, but never at the cost of contrast
- Avoid enterprise-dashboard density and generic blue SaaS styling

## Change discipline

- Preserve existing working flows unless a user annotation explicitly changes them.
- Treat browser annotations as scoped changes.
- Keep visible controls functional.
- Update or add current-version tests when legacy tests no longer match onboarding.

