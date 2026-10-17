# Design

The JantaHR phone app (packages/mobile). Tokens live in packages/mobile/src/ui/theme.ts.

## Brand

- Mark: a heavy white J with a compact ice-blue HR at its cap line, on cobalt. Drawn as vector strokes
  (packages/mobile/assets/brand/mark.svg); never typeset.
- Cobalt #2350E8 (deep #1B3FC2), ice #A9E7FF used only on cobalt.

## Colour

Light: background #F4F6FB, surface #FFFFFF, raised #F8F9FD, ink #121A33, secondary #5A6380, tertiary #8A92AB,
border #E3E7F2. Dark: background #0B1022, surface #141B33, raised #1B2342, ink #EEF1FA, secondary #A3ABC4, primary
#7C97FF. Semantic: success #12805C, warning #B45309, danger #C8283A. Leave kinds have fixed hues (casual cobalt,
sick rose, earned emerald, other amber) so a balance is recognised by colour as well as name.

Strategy: restrained everywhere, committed (cobalt surface) on the Home hero, sign-in and splash.

## Type

Inter, two weights (400, 600) and four sizes (title 28, heading 20, body 16, caption 13); tabular figures for
money, hours and days.

## Shape and space

8-point spacing; radius 14 (controls), 20 (cards), pill for buttons and chips; elevation by tone, a soft shadow only on
floating surfaces.

## Motion

Under 250 ms, ease-out; springs only for the check-in ring and the bottom sheet. Success moments: check-in, leave
applied, request decided.
