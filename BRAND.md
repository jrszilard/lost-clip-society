# The Lost Clip Society — brand notes (design edition)

**The idea:** a deadpan society, investigating the parts the industry abandoned — with
calipers. The humor lives in the club FICTION (case-file stamps, member cards, the oath);
the trust lives in the DATA (dimension tables, confidence labels, fit reports) — always
rendered dead-serious, monospace, engineer-grade. Never wink at the data; never solemnize
the fiction.

## Voice rules
1. **The newcomer test rules everything:** a first-time visitor must understand *what we
   sell and how to get it* from plain language alone — headlines, nav, CTAs, statuses are
   PLAIN. The Society fiction is garnish: one dry joke per section, max.
2. Data copy gets zero jokes. Mono type IS the trust signal.
3. Never mock the cars or the members. The villain is discontinuation, never the reader's
   40-year-old car.
4. Fiction tone: dry, bureaucratic-noir, understated. ("Your dealer laughed. We measured.")

## Visual world
- **Logo:** enamel grille badge (vintage car-club badges are the artifact this honors) —
  see `src/components/Crest.astro`.
- **Palette:** garage-at-night charcoal, aged spec-sheet cream, enamel oxblood, brass.
  Status colors are semantic (requested / in development / measured-fitted) — keep the
  three visually distinct. All values in `src/styles/tokens.css`.
- **Type:** slab serif = the Society's voice; monospace = anything evidentiary (dims,
  OEM numbers, stamps); quiet sans for body.
- **Texture cues:** rubber-stamped statuses, membership cards, graph-paper spec panels.

## Things with fixed meaning (don't restyle away)
- The **status stamps** (Requested / In development / Measured / Fitted on a real car) —
  they encode the part's real state and the color is semantic.
- The **dimension tables** — mono, with CONFIRMED in the measured-green. They're the
  product's trust core, not decoration.
- "**Fits or we remake it free**" and "**measurements published free**" — commitments,
  keep them visible wherever a part can be ordered.
