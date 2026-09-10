// Field-card palette: drab card stock, blued steel, cartridge brass, oxblood.
export const C = {
  field:   "#B7BBAD",
  card:    "#E9E7DC",
  cardAlt: "#DEDBCD",
  ink:     "#1A1C18",
  // Darkened from #5E6357 (~3.15:1 on the sage page bg -- fails WCAG AA
  // for the small sizes it's used at). #40453B lands ~5.3:1 and still
  // sits well below ink, so the muted/primary hierarchy holds.
  muted:   "#40453B",
  rule:    "#A8AC9C",
  brass:   "#8A6A17",
  ox:      "#8C3B2E",
  steel:   "#3E5A6E",
  vitals:  "#4B6B3A",
};

export const label = {
  font: "600 10px 'Oswald',sans-serif",
  letterSpacing: ".14em",
  textTransform: "uppercase",
  color: C.muted,
};

export const numeric = {
  font: "500 13px 'IBM Plex Mono',monospace",
  color: C.ink,
};
