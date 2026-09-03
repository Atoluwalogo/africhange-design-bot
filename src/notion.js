const { Client } = require('@notionhq/client');

// Direct Notion client — used for all operations when NOTION_API_KEY is set
const notion = process.env.NOTION_API_KEY
  ? new Client({ auth: process.env.NOTION_API_KEY })
  : null;

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * Creates a new entry directly in the Notion database.
 */
async function createEntry(data) {
  if (!notion) throw new Error('NOTION_API_KEY environment variable is not set.');
  const page = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: buildProperties(data),
  });
  return { id: page.id, url: page.url };
}

async function searchEntries(query) {
  if (!notion) throw new Error('NOTION_API_KEY is not set for search.');
  const response = await notion.databases.query({
    database_id: DATABASE_ID,
    filter: { property: 'Initiative Name', title: { contains: query } },
    sorts: [{ property: 'Last Updated', direction: 'descending' }],
    page_size: 15,
  });
  return response.results;
}

async function getEntry(pageId) {
  if (!notion) throw new Error('NOTION_API_KEY is not set for get.');
  return await notion.pages.retrieve({ page_id: pageId });
}

async function updateEntry(pageId, data) {
  if (!notion) throw new Error('NOTION_API_KEY is not set for update.');
  const page = await notion.pages.update({ page_id: pageId, properties: buildProperties(data) });
  return page;
}

function buildProperties(data) {
  return {
    'Initiative Name': { title: [{ text: { content: data.initiative_name || '' } }] },
    Designer: { rich_text: [{ text: { content: data.designer || '' } }] },
    'Figma Link': { url: data.figma_link || null },
    'Developer(s) Involved': { rich_text: [{ text: { content: data.developers || '' } }] },
    Status: { select: { name: data.status } },
    'PRD / Ticket Link': { url: data.prd_link || null },
    'Blocker Description': {
      rich_text: [{ text: { content: data.status === 'Blocked' && data.blocker ? data.blocker : '' } }],
    },
    'Live Build Link': {
      url: data.status === 'Developed / Live' && data.live_link ? data.live_link : null,
    },
  };
}

function extractEntryData(page) {
  const p = page.properties;
  return {
    id: page.id, url: page.url,
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

module.exports = { createEntry, searchEntries, getEntry, updateEntry, extractEntryData };
