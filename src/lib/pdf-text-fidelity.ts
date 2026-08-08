/**
 * PDF TEXT FIDELITY.
 *
 *   A delivery format may transform presentation, but it may not erase or
 *   substitute user-authored identity.
 *
 * The PDF export wrote every string with a standard-14 Type1 font fixed at
 * WinAnsiEncoding and no ToUnicode CMap. Any character outside that 8-bit
 * repertoire forced the whole string out as UTF-16BE code units, which the
 * viewer then read back one byte at a time. Verified in the delivered file:
 *
 *   "Zofia Wiśniewska"  ->  \0Z\0o\0f\0i\0a\0 \0W\0i\x01[\0n\0i\0e\0w\0s\0k\0a
 *   "Żabka Polska"      ->  \x01{\0a\0b\0k\0a ...
 *
 * The DOCX in the same archive was correct, because it is Unicode-native — so
 * the two delivered formats did not share a text-encoding contract, and the one
 * most people send to employers was the broken one.
 *
 * The encoder was scoped out of Cluster C on the assumption that it was
 * neutral about content. It is not: it erases employer and person names. An
 * implementation boundary is not a product boundary.
 *
 * TWO HALVES, because embedding one font cannot cover every script:
 *
 * 1. FIX WHAT WE CAN. Liberation Sans is embedded and used whenever the
 *    document needs more than WinAnsi. That covers Latin-Extended, Cyrillic
 *    and Greek — Polish, Czech, Turkish, Romanian, Welsh, Russian, Ukrainian,
 *    Greek names all render correctly.
 *
 * 2. REFUSE THE REST. For a script the embedded font has no glyphs for — CJK,
 *    Arabic, Hebrew, Devanagari — the honest answer is not mojibake. The export
 *    reports which characters it cannot represent so the product can say so and
 *    point at the DOCX, which is already correct. Substituting a name is the
 *    failure this whole audit exists to prevent; doing it inside a font
 *    encoder makes it invisible, not acceptable.
 */

/** Characters a standard-14 WinAnsi font can represent. */
const WINANSI_SAFE = /^[\x20-\x7E\xA0-\xFF€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ\s]*$/;

export function needsUnicodeFont(text: string): boolean {
  return !WINANSI_SAFE.test(text ?? "");
}

/**
 * Scripts Liberation Sans has no glyphs for. Deliberately a positive list of
 * what we KNOW we cannot render, so an unlisted script is attempted rather than
 * pre-emptively refused — the failure mode of guessing wrong here is a report
 * the user can act on, not a corrupted document.
 */
const UNSUPPORTED_SCRIPTS =
  /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯؀-ۿݐ-ݿ֐-׿ऀ-ॿ฀-๿Ⴀ-ჿሀ-፿]/u;

/** The characters in this text that no available font can represent. */
export function unrepresentableCharacters(text: string): string[] {
  const found = new Set<string>();
  for (const ch of text ?? "") if (UNSUPPORTED_SCRIPTS.test(ch)) found.add(ch);
  return [...found];
}

export type PdfFidelityReport = {
  /** True when the document needs the embedded Unicode font. */
  needsUnicode: boolean;
  /** Characters the PDF cannot represent at all. Non-empty means DO NOT ship a PDF silently. */
  unrepresentable: string[];
};

export function assessPdfFidelity(strings: string[]): PdfFidelityReport {
  const joined = strings.filter(Boolean).join("\n");
  return {
    needsUnicode: needsUnicodeFont(joined),
    unrepresentable: unrepresentableCharacters(joined)
  };
}

/** Loaded on demand — the font is ~270 KB and most documents never need it. */
export async function registerUnicodeFont(pdf: {
  addFileToVFS: (file: string, data: string) => void;
  addFont: (file: string, name: string, style: string) => void;
}): Promise<string> {
  const [{ liberationSansRegular }, { liberationSansBold }] = await Promise.all([
    import("@/lib/fonts/liberationSansRegular"),
    import("@/lib/fonts/liberationSansBold")
  ]);
  pdf.addFileToVFS("LiberationSans-Regular.ttf", liberationSansRegular);
  pdf.addFont("LiberationSans-Regular.ttf", "LiberationSans", "normal");
  pdf.addFileToVFS("LiberationSans-Bold.ttf", liberationSansBold);
  pdf.addFont("LiberationSans-Bold.ttf", "LiberationSans", "bold");
  return "LiberationSans";
}
