/**
 * notion.js
 * All Notion API operations for the Africhange Design Tracker.
 */

const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// ─────────────────────────────────────────────────────────────────────────────
// CREATE a new design entry
// ─────────────────────────────────────────────────────────────────────────────
async function createEntry(data) {
  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: buildProperties(data),
  });
  return page;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH entries by initiative name (fuzzy — Notion "contains" filter)
// ─────────────────────────────────────────────────────────────────────────────
async function searchEntries(query) {
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: {
      property: 'Initiative Name',
      title: { contains: query },
    },
    sorts: [{ property: 'Last Updated', direction: 'descending' }],
    page_size: 15,
  });
  return response.results;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET a single entry by Notion page ID
// ─────────────────────────────────────────────────────────────────────────────
async function getEntry(pageId) {
  return await notion.pages.retrieve({ page_id: pageId });
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE an existing entry
// ─────────────────────────────────────────────────────────────────────────────
async function updateEntry(pageId, data) {
  const page = await notion.pages.update({
    page_id: pageId,
    properties: buildProperties(data),
  });
  return page;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Build a Notion properties object from flat form data */
function buildProperties(data) {
  const props = {
    'Initiative Name': {
      title: [{ text: { content: data.initiative_name || '' } }],
    },
    Designer: {
      rich_text: [{ text: { content: data.designer || '' } }],
    },
    'Figma Link': { url: data.figma_link || null },
    'Developer(s) Involved': {
      rich_text: [{ text: { content: data.developers || '' } }],
    },
    Status: { select: { name: data.status } },
    'PRD / Ticket Link': { url: data.prd_link || null },
    'Blocker Description': {
      rich_text: [
        {
          text: {
            content:
              data.status === 'Blocked' && data.blocker ? data.blocker : '',
          },
        },
      ],
    },
    'Live Build Link': {
      url:
        data.status === 'Developed / Live' && data.live_link
          ? data.live_link
          : null,
    },
  };
  return props;
}

/** Extract a flat data object from a raw Notion page */
function extractEntryData(page) {
  const p = page.properties;
  return {
    id: page.id,
    url: page.url,
    initiative_name: p['Initiative Name']?.title?.[0]?.plain_text || '',
    designer: p['Designer']?.rich_text?.[0]?.plain_text || '',
    figma_link: p['Figma Link']?.url || '',
    developers: p['Developer(s) Involved']?.rich_text?.[0]?.plain_text || '',
    prd_link: p['PRD / Ticket Link']?.url || '',
    status: p['Status']?.select?.name || '',
    blocker: p['Blocker Description']?.rich_text?.[0]?.plain_text || '',
    live_link: p['Live Build Link']?.url || '',
  };
}

module.exports = {
  createEntry,
  searchEntries,
  getEntry,
  updateEntry,
  extractEntryData,
};
