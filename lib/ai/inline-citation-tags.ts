export type ParsedCitationTag = {
  sourceNumber: number; // 1-based
  position: number; // position in original text
};

export type ParsedCitationTagsResult = {
  cleanedText: string;
  tags: ParsedCitationTag[];
};

const BRACKET_CITATION_REGEX = /\[(\d+)\]/g;
const INLINE_CITATION_RENDER_REGEX = /\[(\d+)\](?!\()/g;

export function parseCitationTags(text: string): ParsedCitationTagsResult {
  if (!text) return { cleanedText: "", tags: [] };

  BRACKET_CITATION_REGEX.lastIndex = 0;
  const tags: ParsedCitationTag[] = [];
  let match: RegExpExecArray | null = null;

  while ((match = BRACKET_CITATION_REGEX.exec(text)) !== null) {
    const rawSource = match[1];
    const sourceNumber = Number(rawSource);
    if (Number.isInteger(sourceNumber) && sourceNumber > 0) {
      tags.push({
        sourceNumber,
        position: match.index,
      });
    }
  }

  return {
    cleanedText: text,
    tags,
  };
}

export function renderCitationTags(text: string): string {
  if (!text) return "";
  return text.replace(
    INLINE_CITATION_RENDER_REGEX,
    '<citation source="$1"/>',
  );
}
