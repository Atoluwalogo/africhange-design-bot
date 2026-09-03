const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

/**
 * Creates a new entry by posting to the Google Apps Script webhook,
 * which appends a row to the Africhange Design Tracker sheet.
 */
async function createEntry(data) {
  if (!SHEETS_WEBHOOK_URL) throw new Error('SHEETS_WEBHOOK_URL environment variable is not set.');
  const payload = {
    initiative_name: data.initiative_name || '',
    designer: data.designer || '',
    figma_link: data.figma_link || '',
    developers: data.developers || '',
    status: data.status || '',
    prd_link: data.prd_link || '',
    blocker: data.status === 'Blocked' ? (data.blocker || '') : '',
    live_link: data.status === 'Developed / Live' ? (data.live_link || '') : '',
  };
  const response = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sheets webhook returned ${response.status}: ${text}`);
  }
  const result = await response.json();
  if (!result.success) throw new Error(`Sheets webhook error: ${result.error}`);
  return { id: `row-${result.row || 'new'}`, url: null };
}

// Stub functions — search/update not supported via Sheets webhook
async function searchEntries() { return []; }
async function getEntry() { return null; }
async function updateEntry() { return null; }
function extractEntryData(entry) { return entry; }

module.exports = { createEntry, searchEntries, getEntry, updateEntry, extractEntryData };
