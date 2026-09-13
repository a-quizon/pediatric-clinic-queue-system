---
alwaysApply: true
---
# UI/UX Redesign Safety Rules

This project is an existing working pediatric clinic queue and reservation system.

The purpose of this work is to redesign the frontend UI/UX without changing existing business behavior.

## Allowed to change

The AI may modify:

- JSX structure
- React component structure
- page layout
- navigation layout
- desktop layout
- mobile layout
- responsive behavior
- typography
- colors
- spacing
- visual hierarchy
- icons
- buttons
- forms presentation
- table presentation
- cards
- dialogs
- drawers
- bottom sheets
- loading states
- empty states
- error states
- animations
- transitions
- reusable presentation components

The AI may substantially restructure frontend presentation when necessary to improve UX.

## Must NOT change

Do not modify or reinterpret:

- business rules
- queue logic
- reservation logic
- queue calculations
- reservation status definitions
- queue status definitions
- Firebase database structure
- Firebase security rules
- authentication logic
- authorization behavior
- role restrictions
- branch isolation rules
- notification triggers
- SMS behavior
- API contracts
- service-layer business logic

Do not invent new business behavior.

Do not remove existing functionality.

Do not change what an action does merely because the UI is being redesigned.

## Important UI/UX principle

The frontend structure is allowed to change significantly.

For example:

- a desktop sidebar may become bottom navigation on mobile
- a hamburger menu may be replaced by bottom navigation
- cards may become lists
- tables may become mobile-friendly list views
- modals may become full-screen mobile sheets
- page layouts may be reorganized
- controls may be repositioned

These are acceptable as long as the underlying business logic and behavior remain unchanged.

## Before editing

Inspect the existing component and determine:

1. What data it reads.
2. What service/action it calls.
3. What route it belongs to.
4. Which role can access it.
5. Which states it represents.

Preserve those behaviors while redesigning the presentation.