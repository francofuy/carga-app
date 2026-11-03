# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Greenfield, single static HTML file with inline CSS/JS (first prototype, now `app/prototipo-inicial.html`; the real app is `app/carga.html`). Stack choice not confirmed by the user; delegated by default.

## Users
Franco, owner of one electric car, logging his own charging sessions on his iPhone 17 Pro. Opens the app for a few seconds after plugging in or unplugging, or to check how much charging has cost. (Inferred from the brief: single user, personal use. Not confirmed.)

## Product Purpose
Keep a log of electric-car charges and answer "how much am I spending". Success: logging a charge takes a few seconds and one hand, and the screen feels calm, not loaded. The previous attempts at this app felt overloaded to the user; clean and simple is the explicit goal.

## Positioning
A personal logbook, not a fleet or charger-network app. One screen, one question, one big action. (Visual reference given by the user: a betting-app screen with one large headline, a bottom tray of chips and a single large chip as the action; the idea of simplicity is the reference, not the betting elements.)

## Operating Context
Used on an iPhone 17 Pro, full screen (home-screen web app), mostly one-handed. Currency and number formats are Argentine Spanish (`$ 31.179`, `22,4 kWh`). Charges happen at home or at public stations.

## Capabilities and Constraints
- Platform is a web app for iOS, full screen on iPhone 17 Pro (402 × 874 pt, Dynamic Island, home indicator).
- Fields logged today: date, home/public, kWh, price per kWh, cost. Odometer, battery %, station and notes are undecided.
- Price per kWh is hardcoded sample data (home $95, public $310); making it editable is undecided.
- All data in the prototype is sample data and must be replaced with real data.
- Undecided: real product name ("Carga" is a placeholder).

## Brand Commitments
None confirmed. The user binds three design skills to the work: Taste Skill, Emil Kowalski's design-engineering skill, and Impeccable.

## Evidence on Hand
One reference screenshot from a betting app (dark, true black, large light-weight headline, bottom tray with round chips). No real charging data, no logo, no existing brand assets.

## Product Principles
- Less on screen: one question and one primary action per screen; everything else is hidden until asked for.
- Numbers are the interface: the answer is a large figure, not a dashboard.
- Fast to log, calm to read.

## Accessibility & Inclusion
Not established beyond platform defaults (touch targets, contrast, Dynamic Type-friendly sizing, reduced motion).
