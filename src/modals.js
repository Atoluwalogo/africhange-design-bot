/**
 * modals.js
 * All Slack Block Kit modal builders.
 * Modals are rebuilt on every status change so conditional blocks
 * (Blocker / Live Build Link) appear or disappear dynamically.
 */

const STATUS_OPTIONS = [
  { label: 'Not Started', value: 'Not Started' },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Blocked', value: 'Blocked' },
  { label: 'In Review', value: 'In Review' },
  { label: 'Under Development', value: 'Under Development' },
  { label: 'Developed / Live', value: 'Developed / Live' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main design form modal — used for both Log and Update flows
// ─────────────────────────────────────────────────────────────────────────────
function buildDesignFormModal({
  callbackId = 'log_design_submit',
  initialDesignerName = '',
  prefill = {},
}) {
  const status = prefill.status || '';
  const isUpdate = callbackId === 'update_design_submit';
  const showBlocker = status === 'Blocked';
  const showLiveLink = status === 'Developed / Live';

  const blocks = [
    // ── Initiative Name ──
    {
      type: 'input',
      block_id: 'initiative_name',
      label: { type: 'plain_text', text: 'Initiative / Task Name' },
      element: {
        type: 'plain_text_input',
        action_id: 'initiative_name_input',
        placeholder: { type: 'plain_text', text: 'e.g. KYC Flow Redesign' },
        initial_value: prefill.initiative_name || '',
      },
    },

    // ── Designer Name ──
    {
      type: 'input',
      block_id: 'designer_name',
      label: { type: 'plain_text', text: 'Designer Name' },
      element: {
        type: 'plain_text_input',
        action_id: 'designer_name_input',
        placeholder: { type: 'plain_text', text: 'Your full name' },
        initial_value: prefill.designer || initialDesignerName,
      },
    },

    // ── Figma Link ──
    {
      type: 'input',
      block_id: 'figma_link',
      label: { type: 'plain_text', text: 'Figma Link' },
      element: {
        type: 'plain_text_input',
        action_id: 'figma_link_input',
        placeholder: {
          type: 'plain_text',
          text: 'https://www.figma.com/file/...',
        },
        initial_value: prefill.figma_link || '',
      },
    },

    // ── Developer(s) ──
    {
      type: 'input',
      block_id: 'developers',
      label: { type: 'plain_text', text: 'Developer(s) Involved' },
      element: {
        type: 'plain_text_input',
        action_id: 'developers_input',
        placeholder: {
          type: 'plain_text',
          text: 'e.g. Chidi Okafor, Emeka Eze',
        },
        initial_value: prefill.developers || '',
      },
    },

    // ── PRD / Ticket Link (optional) ──
    {
      type: 'input',
      block_id: 'prd_link',
      label: { type: 'plain_text', text: 'PRD / Ticket Link' },
      optional: true,
      element: {
        type: 'plain_text_input',
        action_id: 'prd_link_input',
        placeholder: { type: 'plain_text', text: 'https://...' },
        initial_value: prefill.prd_link || '',
      },
    },

    // ── Status ──
    {
      type: 'input',
      block_id: 'status',
      label: { type: 'plain_text', text: 'Status' },
      element: {
        type: 'static_select',
        action_id: 'status_select',
        placeholder: { type: 'plain_text', text: 'Select a status' },
        ...(status
          ? {
              initial_option: {
                text: { type: 'plain_text', text: status },
                value: status,
              },
            }
          : {}),
        options: STATUS_OPTIONS.map((opt) => ({
          text: { type: 'plain_text', text: opt.label },
          value: opt.value,
        })),
      },
    },
  ];

  // ── Conditional: Blocker Description (only when status = Blocked) ──
  if (showBlocker) {
    blocks.push({
      type: 'input',
      block_id: 'blocker_description',
      label: { type: 'plain_text', text: '🚫 What is blocking this?' },
      element: {
        type: 'plain_text_input',
        action_id: 'blocker_input',
        multiline: true,
        placeholder: {
          type: 'plain_text',
          text: 'Describe the blocker clearly so the team can help resolve it.',
        },
        initial_value: prefill.blocker || '',
      },
    });
  }

  // ── Conditional: Live Build Link (only when status = Developed / Live) ──
  if (showLiveLink) {
    blocks.push({
      type: 'input',
      block_id: 'live_build_link',
      label: { type: 'plain_text', text: '🚀 Live Build Link' },
      element: {
        type: 'plain_text_input',
        action_id: 'live_link_input',
        placeholder: {
          type: 'plain_text',
          text: 'https://staging.africhange.com/...',
        },
        initial_value: prefill.live_link || '',
      },
    });
  }

  return {
    type: 'modal',
    callback_id: callbackId,
    title: {
      type: 'plain_text',
      text: isUpdate ? 'Update Design Entry' : 'Log Design Initiative',
    },
    submit: { type: 'plain_text', text: isUpdate ? 'Update' : 'Submit' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
    // Preserve page_id for update flow so view submission knows which row to update
    private_metadata: prefill.page_id
      ? JSON.stringify({ page_id: prefill.page_id })
      : '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Search modal — used for both Update and Find flows
// ─────────────────────────────────────────────────────────────────────────────
function buildSearchModal({ callbackId, title, placeholder }) {
  return {
    type: 'modal',
    callback_id: callbackId,
    title: { type: 'plain_text', text: title },
    submit: { type: 'plain_text', text: 'Search' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'input',
        block_id: 'search_query',
        label: { type: 'plain_text', text: 'Initiative Name' },
        element: {
          type: 'plain_text_input',
          action_id: 'search_input',
          placeholder: { type: 'plain_text', text: placeholder },
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry select modal — shown after search returns results (Update flow)
// ─────────────────────────────────────────────────────────────────────────────
function buildSelectEntryModal(entries, callbackId) {
  if (entries.length === 0) {
    return {
      type: 'modal',
      callback_id: 'no_results_modal',
      title: { type: 'plain_text', text: 'No Results' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "⚠️ No design entries matched your search.\nTry a shorter or different keyword.",
          },
        },
      ],
    };
  }

  return {
    type: 'modal',
    callback_id: callbackId,
    title: { type: 'plain_text', text: 'Select Entry' },
    submit: { type: 'plain_text', text: 'Open' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Found *${entries.length}* result${entries.length !== 1 ? 's' : ''}. Select the entry to update:`,
        },
      },
      {
        type: 'input',
        block_id: 'entry_select',
        label: { type: 'plain_text', text: 'Design Entry' },
        element: {
          type: 'static_select',
          action_id: 'entry_selected',
          placeholder: { type: 'plain_text', text: 'Choose an entry...' },
          options: entries.map((entry) => ({
            text: {
              type: 'plain_text',
              // Truncate to Slack's 75-char limit for option labels
              text: `${entry.initiative_name} — ${entry.designer} (${entry.status || 'No status'})`.substring(0, 75),
            },
            value: entry.id,
          })),
        },
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Find results modal — displayed inline after a /find-design search
// ─────────────────────────────────────────────────────────────────────────────
function buildFindResultsModal(entries, query) {
  if (entries.length === 0) {
    return {
      type: 'modal',
      callback_id: 'find_results_modal',
      title: { type: 'plain_text', text: 'Search Results' },
      close: { type: 'plain_text', text: 'Close' },
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `⚠️ No results found for *"${query}"*.\nTry a different keyword.`,
          },
        },
      ],
    };
  }

  const STATUS_EMOJI = {
    'Not Started': '⚪',
    'In Progress': '🔵',
    Blocked: '🔴',
    'In Review': '🟡',
    'Under Development': '🟠',
    'Developed / Live': '🟢',
  };

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Found *${entries.length}* result${entries.length !== 1 ? 's' : ''} for *"${query}"*:`,
      },
    },
    { type: 'divider' },
  ];

  entries.forEach((entry) => {
    const emoji = STATUS_EMOJI[entry.status] || '⚪';
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: [
          `*${entry.initiative_name}*`,
          `${emoji} ${entry.status || 'No status'}  |  👤 ${entry.designer}`,
          entry.figma_link ? `🎨 <${entry.figma_link}|View Figma>` : '',
          entry.developers ? `💻 ${entry.developers}` : '',
          entry.prd_link ? `📋 <${entry.prd_link}|Open Ticket>` : '',
          entry.blocker ? `🚫 Blocker: ${entry.blocker}` : '',
          entry.live_link ? `🚀 <${entry.live_link}|Live Build>` : '',
          `<${entry.url}|View in Notion →>`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    });
    blocks.push({ type: 'divider' });
  });

  return {
    type: 'modal',
    callback_id: 'find_results_modal',
    title: { type: 'plain_text', text: 'Search Results' },
    close: { type: 'plain_text', text: 'Close' },
    blocks,
  };
}

module.exports = {
  buildDesignFormModal,
  buildSearchModal,
  buildSelectEntryModal,
  buildFindResultsModal,
};
