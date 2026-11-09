---
# DESIGN.md for the World Bank country indicators dashboard (Lateral take-home). Tokens above the line are the only values UI code may use; prose below the line is the intent the tokens cannot carry.
# The CSS custom properties in dashboard/app/globals.css mirror these values one to one (light on :root, dark under the media query and data-theme). Lint: python <harness>/tools/check_design.py --design DESIGN.md dashboard/app dashboard/components
name: "World Bank country indicators"
version: 1
base_unit: 2
color:
  light:
    page: "#f4f5f3"
    surface: "#fcfcfb"
    surface-2: "#eeefec"
    ink: "#141613"
    ink-2: "#52514e"
    ink-3: "#6b6a65"
    hairline: "#e1e0d9"
    rule: "#c3c2b7"
    accent: "#2a78d6"
    accent-ink: "#1c5cab"
    accent-wash: "#e4eefb"
    status-present: "#2a78d6"
    status-null: "#fab219"
    status-none: "#898781"
    ok: "#006300"
    warn: "#9a5b00"
    series-hic: "#2a78d6"
    series-umc: "#eb6834"
    series-lmc: "#0e9276"
    series-muted: "#8b8982"
    scrim: "rgb(20 22 19 / 0.38)"
    control-border: "#6b6a65"
  dark:
    page: "#0f100f"
    surface: "#1a1a19"
    surface-2: "#232322"
    ink: "#f0efec"
    ink-2: "#c3c2b7"
    ink-3: "#898781"
    hairline: "#2c2c2a"
    rule: "#383835"
    accent: "#3987e5"
    accent-ink: "#86b6ef"
    accent-wash: "#16294a"
    status-present: "#3371bc"
    status-null: "#fab219"
    status-none: "#6f6e69"
    ok: "#0ca30c"
    warn: "#fab219"
    series-hic: "#3987e5"
    series-umc: "#d95926"
    series-lmc: "#19a876"
    series-muted: "#8a8984"
    scrim: "rgb(0 0 0 / 0.62)"
    control-border: "#898781"
  print:
    rule: "#999999"
  semantic:
    background: light.page
    surface: light.surface
    text: light.ink
    text-muted: light.ink-3
    border: light.hairline
    action: light.accent
    action-hover: light.accent-ink
    action-text: light.page
    focus: light.accent
    success: light.ok
    warning: light.warn
    danger: light.warn
type:
  display:
    family: "IBM Plex Sans Condensed"
    weights: [500, 600]
  body:
    family: "IBM Plex Sans"
    weights: [400, 500, 600]
  scale:
    xs: 12
    sm: 13
    md: 14
    base: 15
    md-plus: 16
    lg: 17
    lg-plus: 18
    xl-minus: 20
    xl: 22
    2xl: 26
    3xl: 34
    4xl: 44
  line_length_max_ch: 68
  line_height:
    body: 1.55
    heading: 1.2
spacing:
  scale: [3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 44, 48, 56, 64]
radius:
  xs: 3
  sm: 4
  md: 6
  lg: 8
  full: 999
shadow:
  sm: "none"
  md: "0 0 40px color-mix(in srgb, var(--ink) 22%, transparent)"
motion:
  hover_ms: 0
  enter_ms: 180
  exit_ms: 0
  easing: "ease-out"
  reduced_motion: required
breakpoints:
  phone: 390
  phone_max: 640
  nav_min: 1100
  laptop: 1280
  wide: 1920
icons: "none; status is carried by words next to numbers and by the three completeness cell styles (filled, inset ring, hatched); the burger is three bars"
---

# World Bank country indicators design

A reporting layer over the World Bank Indicators API, built as a take-home for a senior data engineering role. The reader is a data engineer or reviewer who wants to see what the pipeline produced, where data is missing and why, and how to verify every number against the source. The screens are reports, not marketing: dense tables and small charts, read on a laptop, printed or shared as a link.

## The one bold element

The completeness matrix: a grid of filled, ringed and hatched cells, one per country, indicator and year, where color and texture carry the only message the product has to make (present, null, not returned). Every other element is grey, flat and quiet so that the matrix is the first thing the eye lands on. On the brief pages the bold element is the display-face section number in the title. On a report without a matrix (year over year, latest year, income groups, country) the bold element is the chart or ranked table directly under the controls; the controls, the download row and the notes recede.

## What this product must never look like

- No card grids for data that is a table: datasets, manifests and rankings are tables with row headers.
- No decorative color: the accent appears on links, the focus ring and the selected control only; charts use the three income-group series colors and nothing else.
- No gradients except the hatched pattern on not-returned cells and the scroll-edge shadows on wide tables.
- No shadows under cards, charts or tables; elevation is reserved for the drawer.
- No icon library and no emoji: status words sit next to numbers, never color alone.
- No hero, no stat row as a hero: the KPI strip is a ruled line of figures on a baseline, not boxes.

## References

- https://observablehq.com/@observablehq/plot (Observable Plot gallery): taken, small multiples as one ruled grid, tabular numerals, axis text in the muted ink; rejected, the Source Sans and the blue-on-white chrome.
- https://www.ibm.com/design/language/typography/type-basics/ (IBM Plex type basics): taken, Plex Sans for body and Plex Sans Condensed for display at 500 and 600; rejected, the Carbon blue palette and the 2x grid.
- https://datatracker.ietf.org/doc/html/rfc9110 (IETF datatracker reading pages): taken, the measure of 68ch, hairline section rules, the verification command blocks; rejected, the monospace body.

## Hierarchy

Three levels on a report page, by size, weight and color together: the page title in the display family at 4xl, 600, ink; section titles in the display family at xl, 600, ink; everything else in the body family at base or md, 400 or 500, with secondary text at ink-2 and tertiary text at ink-3 in sm. Captions, chart axes and table heads use xs or sm in ink-3. Never grey text on a colored surface; the warn and ok words use their own ink on the surface. Groups are separated by spacing from the scale and by a single hairline between sections, never by boxes; the space between groups (44 on the page, 32 at phone width) is larger than the space within a section (16).

## Layout

Top bar: the brand in the display family on the left, the report links on the right as text with a 2px underline on the current page; a burger on the left opens the drawer (360px, scrim behind) at every width, because the drawer is also the brief's table of contents with the section numbers and statuses; below 1100px the top links hide and the drawer is the only navigation. Content column at 1180px max with a 16px gutter at every width; left aligned throughout. Reports stack sections with a 44px gap; a section is a title, a note under the measure, then its table, chart grid or matrix. Grids use auto-fit columns with a minimum (240 for cards, 280 for small multiples, 420 for country charts and matrices) so the phone layout is one column. The KPI strip is 4 across on a laptop and 2 by 2 on a phone. Tables scroll inside a ruled frame on a phone with the first column sticky; the matrix scrolls inside its own frame.

## States

Every report designs its empty state as a result (a green left rule and a dot before the title, with the legend under it) and its error state through the error boundary with the run id and the health route to check. Loading is the server render, so no spinner and no skeleton; dense states are the full 20-country tables and the 10-dataset catalogue; long content is the brief page with its code samples, which scroll horizontally inside their frame with the scroll-edge shadows. Empty states say why the list is empty and offer the one link that changes the selection.

## Copy voice

Plain reporting voice, addressed to you, the reader checking the pipeline. The core verbs are select, compare, download, verify. Buttons and links are sentence case and name the thing that happens (Copy run id, Download CSV, All datasets). Status is a word next to a number (met, note, not returned, null value), never a color alone. Banned: every word on the marketing and AI phrasing list in check_writing.py, exclamation marks, apologies in errors.

## Decisions

- 2026-11-09: design round 2: 16, 18 and 20 added to the type scale as the sizes the lede, the empty state title and the drawer head already use (the checker does not check type, this is the written record); 12.5 and 11px removed from the CSS in favour of 13 and 12. The error page and the latest empty state follow the States section (what happened, what to check, one action).
- 2026-11-09: design round 1 (findings A and B): single-series charts (latest year bars, the year over year small multiples) draw their data in the accent; the chart is the page's primary content, so the accent on it is the one defended extra place (rubric Color 4), not decoration. The focused line in the all-countries chart is the same accent. The drawer stays at every width (Layout section updated).
- 2026-11-09: design round 1: the 17 off-scale values moved to the nearest step (matrix cell 28, compact cell 24, burger 44 by 36, drawer close 36, chips 8px dots and 8px inline padding, breadcrumb offset 14); 56 added to the spacing scale as the drawer head height (the sticky section offset must equal it).
- 2026-11-09: DESIGN.md created from the existing dashboard/app/globals.css tokens during the design skill review, without changing any value. The spacing scale is written as the rhythm the CSS already uses (base unit 2, steps 3 to 64) rather than the template's 4-based scale; off-scale values the checker still reports are component sizes (cell 26px, burger 40px, legend swatches) and are listed in the review findings. Shadows are none by decision except the drawer. The hover transition is 0ms by decision: hovers change color and underline thickness instantly. The print rule color #999 is a print-only token.
- 2026-11-09: no icon library (PROPOSED, confirm): the dashboard carries no icons by choice; status is words and the three cell textures.
