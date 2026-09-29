export const SERVICES = {
  automation: {
    label: 'AI Automation',
    eyebrow: 'Systems that keep moving',
    headline: 'Remove the work that slows your team down.',
    description: 'Orbact designs reliable workflows that connect your tools, move data, prepare content, and deliver the right information at the right time.',
    examples: [
      ['Content operations', 'Drafting, approvals, asset preparation, and publishing workflows built around your channels.'],
      ['Workflow automation', 'n8n and Make.com flows connecting forms, CRM records, email, and internal systems.'],
      ['Reporting', 'Automated dashboards and scheduled updates that keep teams aligned.'],
    ],
    outcomes: ['Fewer repetitive handoffs', 'Faster turnaround', 'A clear audit trail for important actions'],
  },
  agents: {
    label: 'AI Agents',
    eyebrow: 'Always-ready conversations',
    headline: 'Give every conversation a useful next step.',
    description: 'Orbact builds agents that answer from trusted business knowledge, qualify leads, support customers, and hand off to a person when judgment is needed.',
    examples: [
      ['Customer support', 'Website and WhatsApp assistants grounded in your approved help content.'],
      ['Lead qualification', 'Agents that ask useful questions, capture context, and help schedule calls.'],
      ['Voice and internal knowledge', 'Inbound call flows and searchable knowledge assistants for your team.'],
    ],
    outcomes: ['Faster first response', 'Better-qualified handoffs', 'Consistent answers across channels'],
  },
  development: {
    label: 'AI Development',
    eyebrow: 'Purpose-built tools',
    headline: 'Build the AI product your workflow actually needs.',
    description: 'Orbact develops custom applications, integrations, and AI features for teams whose process does not fit an off-the-shelf tool.',
    examples: [
      ['Custom apps', 'Focused internal tools that replace spreadsheets and repetitive manual steps.'],
      ['API integrations', 'Connect existing software with AI services and operational data.'],
      ['Product features', 'Add search, drafting, classification, and assistants to your existing product.'],
    ],
    outcomes: ['Tools built for your process', 'Clear ownership of the workflow', 'Room to evolve as needs change'],
  },
} as const

export type ServiceSlug = keyof typeof SERVICES
