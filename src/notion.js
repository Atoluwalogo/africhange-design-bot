const SHEETS_WEBHOOK_URL = process.env.SHEETS_WEBHOOK_URL;

async function createEntry(data) {
  if (!SHEETS_WEBHOOK_URL) throw new Error('SHEETS_WEBHOOK_URL is not set.');
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      initiative_name: data.initiative_name || '',
      designer:        data.designer || '',
      figma_link:      data.figma_link || '',
      prototype_link:  data.prototype_link || '',
      developers:      data.developers || '',
      status:          data.status || '',
      prd_link:        data.prd_link || '',
      blocker:         data.status === 'Blocked' ? (data.blocker || '') : '',
      live_link:       data.status === 'Developed / Live' ? (data.live_link || '') : '',
    }),
  });
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`Webhook non-JSON: ${text.slice(0, 200)}`); }
  if (!result.success) throw new Error(`Webhook error: ${result.error}`);
  return { id: `row-${result.row || 'new'}` };
}

async function searchEntries(query) {
  if (!SHEETS_WEBHOOK_URL) throw new Error('SHEETS_WEBHOOK_URL is not set.');
  const url = `${SHEETS_WEBHOOK_URL}?action=search&query=${encodeURIComponent(query || '')}`;
  const res = await fetch(url);
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`Search non-JSON: ${text.slice(0, 200)}`); }
  if (!result.success) throw new Error(`Search error: ${result.error}`);
  return result.entries || [];
}

async function getEntry(rowId) {
  if (!SHEETS_WEBHOOK_URL) throw new Error('SHEETS_WEBHOOK_URL is not set.');
  const url = `${SHEETS_WEBHOOK_URL}?action=get&id=${encodeURIComponent(rowId)}`;
  const res = await fetch(url);
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`Get non-JSON: ${text.slice(0, 200)}`); }
  if (!result.success) throw new Error(`Get error: ${result.error}`);
  return result.entry;
}

async function updateEntry(rowId, data) {
  if (!SHEETS_WEBHOOK_URL) throw new Error('SHEETS_WEBHOOK_URL is not set.');
  const res = await fetch(SHEETS_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'update',
      id:              rowId,
      initiative_name: data.initiative_name || '',
      designer:        data.designer || '',
      figma_link:      data.figma_link || '',
      prototype_link:  data.prototype_link || '',
      developers:      data.developers || '',
      status:          data.status || '',
      prd_link:        data.prd_link || '',
      blocker:         data.status === 'Blocked' ? (data.blocker || '') : '',
      live_link:       data.status === 'Developed / Live' ? (data.live_link || '') : '',
    }),
  });
  const text = await res.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error(`Update non-JSON: ${text.slice(0, 200)}`); }
  if (!result.success) throw new Error(`Update error: ${result.error}`);
  return result;
}

function extractEntryData(entry) {
  if (!entry) return null;
  return {
    id:              entry.id || '',
    initiative_name: entry.initiative_name || '',
    designer:        entry.designer || '',
    figma_link:      entry.figma_link || '',
    prototype_link:  entry.prototype_link || '',
    developers:      entry.developers || '',
    status:          entry.status || '',
    prd_link:        entry.prd_link || '',
    blocker:         entry.blocker || '',
    live_link:       entry.live_link || '',
  };
}

module.exports = { createEntry, searchEntries, getEntry, updateEntry, extractEntryData };
