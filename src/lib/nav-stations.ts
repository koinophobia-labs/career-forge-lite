// Navigation structure for the command shell. Primary = the five stations of
// the live application workflow (paste post → apply → track → outreach →
// interview). Secondary = support and reference pages that stay fully
// routable but shouldn't compete for attention during a sprint. Kept as a
// plain data module so the nav regression suite can verify it without JSX.

export type NavStation = readonly [label: string, href: string];

export const primaryStations: readonly NavStation[] = [
  ["Today", "/"],
  ["Tailor", "/tailor"],
  ["Applications", "/applications"],
  ["Outreach", "/outreach"],
  ["Interview", "/interview"]
];

export const secondaryStations: readonly NavStation[] = [
  ["Profile", "/profile"],
  ["Targets", "/targets"],
  ["Versions", "/versions"],
  ["Resume Builder", "/resume-builder"],
  ["Weekly", "/weekly"],
  ["Data", "/settings"],
  ["Beta", "/beta"]
];
