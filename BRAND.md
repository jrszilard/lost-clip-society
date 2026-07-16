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

## Visual world — "The Paint Chart Era"
- **The idea:** ~80% of new cars today are white/black/grey/silver; in 1970 Mopar alone
  offered ~30 colors. The site looks like that era's option list: warm dealer-brochure
  stock, and every accent a REAL named pre-1990 paint (Mexico Blue, Signal Orange,
  Grabber Blue, Plum Crazy, Sublime, Sunflower, Bahia Red, Irish Green) — credited like
  the catalog credits OEM numbers. One paint, one job; see `src/styles/tokens.css`.
- **Color is chrome, never product:** part renders stay neutral resin everywhere; a part
  earns its real trim colors only on its own page, from its own OEM data.
- **Logo:** enamel grille badge (vintage car-club badges are the artifact this honors) —
  see `src/components/Crest.astro`. It keeps its oxblood/brass: a badge doesn't repaint
  with the wall behind it.
- **Palette mechanics:** default theme is the light "showroom brochure"; dark is "night
  race" (same paints, tarmac ground). Status colors are semantic (requested / in
  development / measured-fitted) — hues re-keyed to period paints, meaning unchanged,
  keep the three visually distinct.
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
