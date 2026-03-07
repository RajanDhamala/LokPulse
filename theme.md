# Theme Decision (MVP)

## Mode
- Use **dark mode only** across the entire project.
- No light/dark toggle in MVP.
- No time spent on advanced theme setup for now.

## Why
- Fast development is the priority.
- Consistent UI with less overhead.
- Focus effort on data scraping, parsing, API quality, and visualization logic.

## UI Stack
- Use **shadcn/ui** components.
- Keep styles minimal and reusable.
- Avoid custom design system complexity in this phase.

## Base Dark Style Rules
- App background: very dark (`zinc-950` style)
- Card/surface: dark (`zinc-900` style)
- Borders: subtle dark (`zinc-800` style)
- Primary text: light (`zinc-100` style)
- Secondary text: muted (`zinc-400` style)
- Positive trend: green accent
- Negative trend: red accent

## Implementation Notes
1. Set dark styling globally at app layout/root level.
2. Every page/component should assume dark mode by default.
3. Do not add runtime theme switching logic.
4. Keep contrast readable for tables/cards/charts.

## Component Direction (shadcn)
- Use: `Card`, `Badge`, `Table`, `Tabs`, `Skeleton`, `Tooltip`, `Separator`
- Keep spacing and typography clean; avoid visual over-design.

## Out of Scope (for now)
- Theme switcher
- Full semantic token system
- Party-specific polished branding palette
- Advanced color accessibility tuning

## Revisit Later
After core features are stable:
1. Add optional light mode.
2. Add semantic color tokens.
3. Add polished chart palettes and accessibility refinements.