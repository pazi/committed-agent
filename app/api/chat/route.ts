import Anthropic from '@anthropic-ai/sdk';
import {
  getCampaignPerformance,
  getAdGroupPerformance,
  getDevicePerformance,
  getDateTrend,
} from '../../../src/services/bigquery.service';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Je bent een ervaren online marketing specialist en campagne-optimalisatie expert. Je werkt voor een marketingbureau en helpt campagnemanagers met het optimaliseren van Google Ads campagnes.

Je hebt toegang tot live campagnedata via tools. Gebruik deze tools om data op te halen voordat je advies geeft.

BELANGRIJK — Je antwoord wordt op twee plekken getoond:
1. Het VOLLEDIGE antwoord (met tabellen, data, analyse) verschijnt automatisch in het canvas-paneel links op de pagina.
2. De gebruiker ziet in de chat alleen wat er NA de separator "---" staat.

Structureer je antwoord ALTIJD exact zo:

[Volledige data-analyse met tabellen, KPI's, aanbevelingen — dit verschijnt in het canvas]

---

[Hier komt ALLEEN een korte tekst voor de chat, maximaal 1-2 zinnen. Bijvoorbeeld: "De data staat links in het canvas. Wat wil je nu doen?"]

VERVOLGACTIES:
- [Actie 1, bijv: "Inzoomen op campagne X"]
- [Actie 2, bijv: "Device performance bekijken"]
- [Actie 3, bijv: "Slecht presterende ad groups pauzeren"]

De vervolgacties worden als klikbare knoppen getoond. Geef er altijd 2-4.

Richtlijnen voor de analyse:
- Bereken en toon altijd relevante KPI's: CTR, CPC, CPM, ROAS
- Gebruik markdown tabellen voor overzichten
- Identificeer slecht presterende onderdelen en geef concrete actie-suggesties
- Prioriteer suggesties op verwachte impact
- Denk aan: pacing, bereik, performance trends
- Antwoord altijd in het Nederlands
- Wees direct en concreet, geen vage adviezen`;

const tools: Anthropic.Tool[] = [
  {
    name: 'get_campaigns',
    description: 'Haal een overzicht op van alle campagnes met geaggregeerde performance metrics (impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS). Standaard over de afgelopen 30 dagen.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: [],
    },
  },
  {
    name: 'get_adgroup_performance',
    description: 'Haal performance metrics op per ad group (advertentiegroep) voor een specifieke campagne. Geeft impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS per ad group.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_device_breakdown',
    description: 'Haal performance metrics op per device (desktop, mobile, tablet) voor een specifieke campagne.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_date_trend',
    description: 'Haal dagelijkse performance trends op voor een specifieke campagne. Handig om pacing en trends te analyseren.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: { type: 'string', description: 'Het campaign ID' },
        days: { type: 'number', description: 'Aantal dagen terug (standaard 30)' },
      },
      required: ['campaign_id'],
    },
  },
];

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_campaigns': {
      const data = await getCampaignPerformance((input.days as number) ?? 30);
      return JSON.stringify(data, null, 2);
    }
    case 'get_adgroup_performance': {
      const data = await getAdGroupPerformance(
        input.campaign_id as string,
        (input.days as number) ?? 30,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_device_breakdown': {
      const data = await getDevicePerformance(
        input.campaign_id as string,
        (input.days as number) ?? 30,
      );
      return JSON.stringify(data, null, 2);
    }
    case 'get_date_trend': {
      const data = await getDateTrend(
        input.campaign_id as string,
        (input.days as number) ?? 30,
      );
      return JSON.stringify(data, null, 2);
    }
    default:
      return JSON.stringify({ error: `Onbekende tool: ${name}` });
  }
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function POST(request: Request) {
  const { messages } = (await request.json()) as { messages: ChatMessage[] };

  const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Agentic loop: blijf tool calls afhandelen tot Claude een tekst-antwoord geeft
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools,
    messages: anthropicMessages,
  });

  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ContentBlockParam & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        block.type === 'tool_use',
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      const result = await executeTool(toolUse.name, toolUse.input);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    anthropicMessages.push({ role: 'assistant', content: response.content });
    anthropicMessages.push({ role: 'user', content: toolResults });

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: anthropicMessages,
    });
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  const text = textBlock && 'text' in textBlock ? textBlock.text : '';

  return Response.json({ role: 'assistant', content: text });
}
