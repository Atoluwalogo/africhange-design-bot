/**
 * helpers.js
 * Shared utilities: validation, Slack profile lookup, notification builder.
 */

// ─────────────────────────────────────────────────────────────────────────────
// URL Validators
// ─────────────────────────────────────────────────────────────────────────────
function isValidUrl(str) {
  if (!str || !str.trim()) return false;
  try {
    new URL(str.trim());
    return true;
  } catch {
    return false;
  }
}

function isFigmaUrl(str) {
  return isValidUrl(str) && str.includes('figma.com');
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate form submission data
// Returns an errors object (Slack format) or null if valid.
// ─────────────────────────────────────────────────────────────────────────────
function validateFormData(data) {
  const errors = {};

  if (!data.initiative_name?.trim()) {
    errors['initiative_name'] = {
      type: 'plain_text',
      text: 'Initiative name is required.',
    };
  }
  if (!data.designer?.trim()) {
    errors['designer_name'] = {
      type: 'plain_text',
      text: 'Designer name is required.',
    };
  }
  if (!data.figma_link?.trim()) {
    errors['figma_link'] = {
      type: 'plain_text',
      text: 'Figma link is required.',
    };
  } else if (!isFigmaUrl(data.figma_link)) {
    errors['figma_link'] = {
      type: 'plain_text',
      text: 'Please enter a valid Figma URL (must contain figma.com).',
    };
  }
  if (!data.developers?.trim()) {
    errors['developers'] = {
      type: 'plain_text',
      text: 'Please name at least one developer.',
    };
  }
  if (!data.status) {
    errors['status'] = {
      type: 'plain_text',
      text: 'Please select a status.',
    };
  }
  if (data.prd_link?.trim() && !isValidUrl(data.prd_link)) {
    errors['prd_link'] = {
      type: 'plain_text',
      text: 'Please enter a valid URL for the PRD / ticket.',
    };
  }
  // Conditional required fields
  if (data.status === 'Blocked' && !data.blocker?.trim()) {
    errors['blocker_description'] = {
      type: 'plain_text',
      text: 'Please describe the blocker.',
    };
  }
  if (data.status === 'Developed / Live' && !data.live_link?.trim()) {
    errors['live_build_link'] = {
      type: 'plain_text',
      text: 'Please provide the live build link.',
    };
  }
  if (data.live_link?.trim() && !isValidUrl(data.live_link)) {
    errors['live_build_link'] = {
      type: 'plain_text',
      text: 'Please enter a valid URL for the live build.',
    };
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract flat form data from Slack view state values
// ─────────────────────────────────────────────────────────────────────────────
function extractFormValues(values) {
  return {
    initiative_name:
      values.initiative_name?.initiative_name_input?.value || '',
    designer: values.designer_name?.designer_name_input?.value || '',
    figma_link: values.figma_link?.figma_link_input?.value || '',
    developers: values.developers?.developers_input?.value || '',
    prd_link: values.prd_link?.prd_link_input?.value || '',
    status: values.status?.status_select?.selected_option?.value || '',
    blocker: values.blocker_description?.blocker_input?.value || '',
    live_link: values.live_build_link?.live_link_input?.value || '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch the Slack display name for a user ID
// ─────────────────────────────────────────────────────────────────────────────
async function getSlackDisplayName(client, userId) {
  try {
    const result = await client.users.info({ user: userId });
    return (
      result.user?.profile?.real_name ||
      result.user?.profile?.display_name ||
      result.user?.name ||
      ''
    );
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Slack Block Kit notification blocks for channel posts
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_EMOJI = {
  'Not Started': '⚪',
  'In Progress': '🔵',
  Blocked: '🔴',
  'In Review': '🟡',
  'Under Development': '🟠',
  'Developed / Live': '🟢',
};

function buildNotificationBlocks(data, action = 'logged') {
  const emoji = STATUS_EMOJI[data.status] || '⚪'';
  const actionLabel =
    action === 'logged' ? '🎨  New Design Logged' : '👝  Design Updated';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: actionLabel },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Initiative:*\n${data.initiative_name}` },
        { type: 'mrkdwn', text: `*Designer:*\n${data.designer}` },
        {
          type: 'mrkdwn',
          text: `*Status:*\n${emoji}  ${data.status}`,
        },
        {
          type: 'mrkdwn',
          text: `*Developer(s):*\n${data.developers}`,
        },
      ],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: data.figma_link
            ? `*Figma:*\n<${data.figma_link}|View Design>`
            : '*Figma:*\nNot provided',
        },
        {
          type: 'mrkdwn',
          text: data.prd_link
            ? `*PRD / Ticket:*\n<${data.prd_link}|Open Ticket>`
            : '*PRD / Ticket:*\nNot provided',
        },
      ],
    },
  ];

  // Conditional: Blocker
  if (data.status === 'Blocked' && data.blocker) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚫 *Blocker:*\n${data.blocker}`,
      },
    });
  }

  // Conditional: Live Build Link
  if (data.status === 'Developed / Live' && data.live_link) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🚀 *Live Build:*\n<${data.live_link}|View Live Build>`,
      },
    });
  }

  // Notion link button
  if (data.notion_url) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in Notion ↗' },
          url: data.notion_url,
          style: 'primary',
        },
      ],
    });
  }

  return blocks;
}

module.exports = {
  validateFormData,
  extractFormValues,
  getSlackDisplayName,
  buildNotificationBlocks,
};
