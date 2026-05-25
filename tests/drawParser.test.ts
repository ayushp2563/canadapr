import { describe, it, expect } from 'vitest';
import * as cheerio from 'cheerio';

// Inline the parse logic for testing without DB dependency
function parseDrawRow($: cheerio.CheerioAPI, row: cheerio.Element) {
  const cells = $(row).find('td');
  if (cells.length < 4) return null;

  const getText = (i: number) => $(cells.get(i)!).text().replace(/\s+/g, ' ').trim();

  const rawDrawNum = getText(0).replace(/[^\d]/g, '');
  const rawDate = getText(1);
  const drawType = getText(2) || 'No program specified';
  const rawCrs = getText(3).replace(/[^\d]/g, '');
  const rawInvitations = getText(4).replace(/[^\d,]/g, '').replace(/,/g, '');

  const drawNumber = parseInt(rawDrawNum, 10);
  const crsScore = parseInt(rawCrs, 10);
  const invitationsIssued = parseInt(rawInvitations, 10);

  if (isNaN(drawNumber) || isNaN(crsScore) || isNaN(invitationsIssued)) return null;

  const drawDate = new Date(rawDate);
  if (isNaN(drawDate.getTime())) return null;

  return { drawNumber, drawDate, drawType, crsScore, invitationsIssued };
}

const SAMPLE_HTML = `
<table>
  <tbody>
    <tr>
      <td>288</td>
      <td>April 2, 2025</td>
      <td>Canadian Experience Class</td>
      <td>524</td>
      <td>4,500</td>
      <td>N/A</td>
    </tr>
    <tr>
      <td>287</td>
      <td>March 19, 2025</td>
      <td>No program specified</td>
      <td>489</td>
      <td>3,200</td>
      <td>N/A</td>
    </tr>
    <tr>
      <td>bad</td>
      <td>not-a-date</td>
      <td>Bad Draw</td>
      <td>NaN</td>
      <td>0</td>
    </tr>
  </tbody>
</table>
`;

describe('drawParser', () => {
  const $ = cheerio.load(SAMPLE_HTML);

  it('parses draw #288 correctly', () => {
    const rows = $('tbody tr').toArray();
    const draw = parseDrawRow($, rows[0]!);
    expect(draw).not.toBeNull();
    expect(draw!.drawNumber).toBe(288);
    expect(draw!.crsScore).toBe(524);
    expect(draw!.invitationsIssued).toBe(4500);
    expect(draw!.drawType).toBe('Canadian Experience Class');
  });

  it('parses draw #287 correctly', () => {
    const rows = $('tbody tr').toArray();
    const draw = parseDrawRow($, rows[1]!);
    expect(draw).not.toBeNull();
    expect(draw!.drawNumber).toBe(287);
    expect(draw!.crsScore).toBe(489);
    expect(draw!.invitationsIssued).toBe(3200);
    expect(draw!.drawType).toBe('No program specified');
  });

  it('returns null for malformed row', () => {
    const rows = $('tbody tr').toArray();
    const draw = parseDrawRow($, rows[2]!);
    expect(draw).toBeNull();
  });

  it('parses all valid rows', () => {
    const rows = $('tbody tr').toArray();
    const draws = rows.map((r) => parseDrawRow($, r)).filter(Boolean);
    expect(draws).toHaveLength(2);
  });
});
