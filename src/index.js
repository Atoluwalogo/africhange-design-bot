/**
 * index.js — Africhange Design Bot
 *
 * Three slash commands:
 *   /log-design    → Log a new design initiative to the tracker
 *   /update-design → Search and update an existing entry
 *   /find-design   → Search and retrieve design details + links
 *
 * Hosting: Railway (HTTP mode, auto-assigned PORT)
 * Database: Africhange Design Tracker (Google Sheets via Apps Script webhook)
 */

require('dotenv').config();

const { App } = require('@slack/bolt');
const {
  createEntry,
  searchEntries,
  getEntry,
  updateEntry,
  extractEntryData,
} = require('./notion');
const {
  buildDesignFormModal,
  buildSearchModal,
  buildSelectEntryModal,
  buildFindResultsModal,
} = require('./modals');
const {
  validateFormData,
  extractFormValues,
  getSlackDisplayName,
  buildNotificationBlocks,
} = require('./helpers');

// ─────────────────────────────────────────────────────────────────────────────
// App initialisation
// ─────────────────────────────────────────────────────────────────────────────
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  // Railway provides a public HTTPS URL — no Socket Mode needed
  port: process.env.PORT || 3000,
});

const NOTIFY_CHANNEL = process.env.SLACK_NOTIFICATION_CHANNEL;

// ═════════════════════════════════════════════════════════════════════════════
// /log-design — Open the "Log Design Initiative" modal
// ═════════════════════════════════════════════════════════════════════════════
app.command('/log-design', async ({ command, ack, client, logger }) => {
  await ack();
  try {
    const designerName = await getSlackDisplayName(client, command.user_id);
    await client.views.open({
      trigger_id: command.trigger_id,
      view: buildDesignFormModal({
        callbackId: 'log_design_submit',
        initialDesignerName: designerName,
      }),
    });
  } catch (err) {
    logger.error('Error opening log-design modal:', err);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ACTION: status_select changed — rebuild modal with/without conditional blocks
// Applies to both log and update flows (same action_id, different callback_id)
// ═════════════════════════════════════════════════════════════════════════════
app.action('status_select', async ({ ack, body, client, logger }) => {
  await ack();
  try {
    const selectedStatus = body.actions[0].selected_option.value;
    const currentValues = body.view.state.values;
    const callbackId = body.view.callback_id;

    // Preserve all current form values
    const currentData = extractFormValues(currentValues);
    currentData.status = selectedStatus;

    // Preserve the page_id in update flow
    let pageId = null;
    if (body.view.private_metadata) {
      try {
        pageId = JSON.parse(body.view.private_metadata).page_id;
      } catch {}
    }

    await client.views.update({
      view_id: body.view.id,
      hash: body.view.hash,
      view: buildDesignFormModal({
        callbackId,
        prefill: { ...currentData, page_id: pageId },
      }),
    });
  } catch (err) {
    // hash mismatch (race condition) — silently ignore
    if (err.data?.error !== 'hash_collision') {
      logger.error('Error updating view on status change:', err);
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// VIEW SUBMIT: log_design_submit — Validate, write to tracker, notify channel
// ═════════════════════════════════════════════════════════════════════════════
app.view('log_design_submit', async ({ ack, body, view, client, logger }) => {
  const data = extractFormValues(view.state.values);
  const errors = validateFormData(data);

  if (errors) {
    await ack({ response_action: 'errors', errors });
    return;
  }

  await ack(); // Close modal immediately, work happens asynchronously

  try {
    await createEntry(data);

    // Post to shared design-tracker channel
    if (NOTIFY_CHANNEL) {
      await client.chat.postMessage({
        channel: NOTIFY_CHANNEL,
        text: `🎨 ${data.designer} logged a new design: ${data.initiative_name}`,
        blocks: buildNotificationBlocks(data, 'logged'),
      });
    }

    // DM the submitting designer with a confirmation
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ *${data.initiative_name}* has been added to the design tracker.`,
    });
  } catch (err) {
    logger.error('Error creating tracker entry:', err);
    await client.chat.postMessage({
      channel: body.user.id,
      text: '❌ Something went wrong saving to the tracker. Please try `/log-design` again. If it persists, ping your dev team.',
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// /update-design — Open a search modal to find an existing entry
// ═════════════════════════════════════════════════════════════════════════════
app.command('/update-design', async ({ command, ack, client, logger }) => {
  await ack();
  try {
    await client.views.open({
      trigger_id: command.trigger_id,
      view: buildSearchModal({
        callbackId: 'search_to_update',
        title: 'Update Design Entry',
        placeholder: 'Type part of the initiative name...',
      }),
    });
  } catch (err) {
    logger.error('Error opening update-design search modal:', err);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEW SUBMIT: search_to_update — Search tracker, push results select modal
// ─────────────────────────────────────────────────────────────────────────────
app.view('search_to_update', async ({ ack, view, logger }) => {
  const query = view.state.values.search_query?.search_input?.value || '';
  try {
    const results = await searchEntries(query);
    const entries = results.map(extractEntryData);

    // Push the entry select modal on top of the search modal
    await ack({
      response_action: 'push',
      view: buildSelectEntryModal(entries, 'select_entry_to_update'),
    });
  } catch (err) {
    logger.error('Error searching tracker for update:', err);
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        callback_id: 'error_modal',
        title: { type: 'plain_text', text: 'Error' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Could not reach the tracker right now. Please try again.',
            },
          },
        ],
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEW SUBMIT: select_entry_to_update — Fetch selected entry, push edit modal
// ─────────────────────────────────────────────────────────────────────────────
app.view('select_entry_to_update', async ({ ack, view, logger }) => {
  const pageId =
    view.state.values.entry_select?.entry_selected?.selected_option?.value;

  if (!pageId) {
    await ack({
      response_action: 'errors',
      errors: {
        entry_select: {
          text: 'Please select an entry.',
        },
      },
    });
    return;
  }

  try {
    const page = await getEntry(pageId);
    const entry = extractEntryData(page);

    // Push the prefilled edit modal
    await ack({
      response_action: 'push',
      view: buildDesignFormModal({
        callbackId: 'update_design_submit',
        prefill: { ...entry, page_id: pageId },
      }),
    });
  } catch (err) {
    logger.error('Error fetching tracker entry for edit:', err);
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        callback_id: 'error_modal',
        title: { type: 'plain_text', text: 'Error' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Could not load that entry from the tracker. Please try again.',
            },
          },
        ],
      },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEW SUBMIT: update_design_submit — Validate, update tracker, notify channel
// ─────────────────────────────────────────────────────────────────────────────
app.view('update_design_submit', async ({ ack, body, view, client, logger }) => {
  const data = extractFormValues(view.state.values);
  const errors = validateFormData(data);

  if (errors) {
    await ack({ response_action: 'errors', errors });
    return;
  }

  let pageId = null;
  try {
    pageId = JSON.parse(view.private_metadata || '{}').page_id;
  } catch {}

  if (!pageId) {
    await ack({
      response_action: 'errors',
      errors: {
        initiative_name: {
          text: 'Could not identify which entry to update. Please start again with /update-design.',
        },
      },
    });
    return;
  }

  await ack();

  try {
    await updateEntry(pageId, data);

    // Post update to shared channel
    if (NOTIFY_CHANNEL) {
      await client.chat.postMessage({
        channel: NOTIFY_CHANNEL,
        text: `📝 ${data.designer} updated a design: ${data.initiative_name}`,
        blocks: buildNotificationBlocks(data, 'updated'),
      });
    }

    // DM the designer with confirmation
    await client.chat.postMessage({
      channel: body.user.id,
      text: `✅ *${data.initiative_name}* has been updated in the tracker.`,
    });
  } catch (err) {
    logger.error('Error updating tracker entry:', err);
    await client.chat.postMessage({
      channel: body.user.id,
      text: '❌ Something went wrong updating the tracker. Please try `/update-design` again.',
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// /find-design [query] — Search and display design details
// ═════════════════════════════════════════════════════════════════════════════
app.command('/find-design', async ({ command, ack, client, logger }) => {
  await ack();

  const query = (command.text || '').trim();

  // No query provided — open a search modal instead
  if (!query) {
    try {
      await client.views.open({
        trigger_id: command.trigger_id,
        view: buildSearchModal({
          callbackId: 'search_to_find',
          title: 'Find Design',
          placeholder: 'e.g. KYC Flow, Onboarding...',
        }),
      });
    } catch (err) {
      logger.error('Error opening find-design modal:', err);
    }
    return;
  }

  // Query provided inline — search immediately and show results in a modal
  try {
    const results = await searchEntries(query);
    const entries = results.map(extractEntryData);

    await client.views.open({
      trigger_id: command.trigger_id,
      view: buildFindResultsModal(entries, query),
    });
  } catch (err) {
    logger.error('Error searching tracker for find:', err);
    await client.chat.postEphemeral({
      channel: command.channel_id,
      user: command.user_id,
      text: '❌ Could not reach the tracker right now. Please try again.',
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// VIEW SUBMIT: search_to_find — Search tracker and display results in same modal
// ─────────────────────────────────────────────────────────────────────────────
app.view('search_to_find', async ({ ack, view, logger }) => {
  const query = view.state.values.search_query?.search_input?.value || '';
  try {
    const results = await searchEntries(query);
    const entries = results.map(extractEntryData);

    await ack({
      response_action: 'update',
      view: buildFindResultsModal(entries, query),
    });
  } catch (err) {
    logger.error('Error in search_to_find:', err);
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        callback_id: 'error_modal',
        title: { type: 'plain_text', text: 'Error' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '❌ Could not reach the tracker. Please try again.',
            },
          },
        ],
      },
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Start
// ═════════════════════════════════════════════════════════════════════════════
(async () => {
  await app.start();
  console.log(
    `⚡️ Africhange Design Bot is running on port ${process.env.PORT || 3000}`
  );
})();
