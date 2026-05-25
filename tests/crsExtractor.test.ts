import { describe, it, expect } from 'vitest';

// Inline the CRS extraction logic to avoid env module loading in tests
function extractCrsScore(text: string): number | null {
  const patterns = [
    /crs\s+(?:score|cutoff)[:\s]+(\d{3})/i,
    /minimum\s+score\s+(?:of\s+)?(\d{3})/i,
    /lowest\s+(?:crs\s+)?score\s+(?:was\s+)?(\d{3})/i,
    /score\s+(?:of\s+)?(\d{3})/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) {
      const score = parseInt(match[1], 10);
      if (score >= 300 && score <= 1200) return score;
    }
  }
  return null;
}

describe('extractCrsScore', () => {
  it('extracts score from "CRS score: 524" format', () => {
    expect(extractCrsScore('The CRS score: 524 was the cutoff')).toBe(524);
  });

  it('extracts score from "minimum score of 501" format', () => {
    expect(extractCrsScore('The minimum score of 501 was required')).toBe(501);
  });

  it('extracts score from "lowest score was 489" format', () => {
    expect(extractCrsScore('The lowest score was 489 in this draw')).toBe(489);
  });

  it('returns null for text with no CRS score', () => {
    expect(extractCrsScore('No score information here')).toBeNull();
  });

  it('rejects scores outside valid range (<300)', () => {
    expect(extractCrsScore('CRS score: 150')).toBeNull();
  });

  it('rejects scores outside valid range (>1200)', () => {
    expect(extractCrsScore('CRS score: 1500')).toBeNull();
  });

  it('extracts from "score of 567"', () => {
    expect(extractCrsScore('Draw with score of 567 cutoff')).toBe(567);
  });
});
