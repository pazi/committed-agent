module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/client.mjs [app-route] (ecmascript) <export Anthropic as default>");
(()=>{
    const e = new Error("Cannot find module '@/src/services/bigquery.service'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
;
const anthropic = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__["default"]({
    apiKey: process.env.ANTHROPIC_API_KEY
});
const SYSTEM_PROMPT = `Je bent een ervaren online marketing specialist en campagne-optimalisatie expert. Je werkt voor een marketingbureau en helpt campagnemanagers met het optimaliseren van Google Ads campagnes.

Je hebt toegang tot live campagnedata via tools. Gebruik deze tools om data op te halen voordat je advies geeft.

Richtlijnen:
- Analyseer data grondig en geef onderbouwde optimalisaties met concrete cijfers
- Bereken en toon altijd relevante KPI's: CTR, CPC, CPM, ROAS
- Vergelijk performance tussen campagnes, ad groups en devices
- Identificeer slecht presterende onderdelen en geef concrete actie-suggesties
- Denk aan: pacing (budget verdeling over tijd), bereik, performance trends
- Geef suggesties als concrete actiepunten, bijv: "Pauzeer ad group X (CTR 0.2%, ver onder gemiddelde van 1.5%)"
- Als je meerdere suggesties hebt, prioriteer ze op verwachte impact
- Antwoord altijd in het Nederlands
- Gebruik tabellen voor overzichten waar dat helpt
- Wees direct en concreet, geen vage adviezen`;
const tools = [
    {
        name: 'get_campaigns',
        description: 'Haal een overzicht op van alle campagnes met geaggregeerde performance metrics (impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS). Standaard over de afgelopen 30 dagen.',
        input_schema: {
            type: 'object',
            properties: {
                days: {
                    type: 'number',
                    description: 'Aantal dagen terug (standaard 30)'
                }
            },
            required: []
        }
    },
    {
        name: 'get_adgroup_performance',
        description: 'Haal performance metrics op per ad group (advertentiegroep) voor een specifieke campagne. Geeft impressions, clicks, cost, conversions, CTR, CPC, CPM, ROAS per ad group.',
        input_schema: {
            type: 'object',
            properties: {
                campaign_id: {
                    type: 'string',
                    description: 'Het campaign ID'
                },
                days: {
                    type: 'number',
                    description: 'Aantal dagen terug (standaard 30)'
                }
            },
            required: [
                'campaign_id'
            ]
        }
    },
    {
        name: 'get_device_breakdown',
        description: 'Haal performance metrics op per device (desktop, mobile, tablet) voor een specifieke campagne.',
        input_schema: {
            type: 'object',
            properties: {
                campaign_id: {
                    type: 'string',
                    description: 'Het campaign ID'
                },
                days: {
                    type: 'number',
                    description: 'Aantal dagen terug (standaard 30)'
                }
            },
            required: [
                'campaign_id'
            ]
        }
    },
    {
        name: 'get_date_trend',
        description: 'Haal dagelijkse performance trends op voor een specifieke campagne. Handig om pacing en trends te analyseren.',
        input_schema: {
            type: 'object',
            properties: {
                campaign_id: {
                    type: 'string',
                    description: 'Het campaign ID'
                },
                days: {
                    type: 'number',
                    description: 'Aantal dagen terug (standaard 30)'
                }
            },
            required: [
                'campaign_id'
            ]
        }
    }
];
async function executeTool(name, input) {
    switch(name){
        case 'get_campaigns':
            {
                const data = await getCampaignPerformance(input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_adgroup_performance':
            {
                const data = await getAdGroupPerformance(input.campaign_id, input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_device_breakdown':
            {
                const data = await getDevicePerformance(input.campaign_id, input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_date_trend':
            {
                const data = await getDateTrend(input.campaign_id, input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        default:
            return JSON.stringify({
                error: `Onbekende tool: ${name}`
            });
    }
}
async function POST(request) {
    const { messages } = await request.json();
    const anthropicMessages = messages.map((m)=>({
            role: m.role,
            content: m.content
        }));
    // Agentic loop: blijf tool calls afhandelen tot Claude een tekst-antwoord geeft
    let response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools,
        messages: anthropicMessages
    });
    while(response.stop_reason === 'tool_use'){
        const toolUseBlocks = response.content.filter((block)=>block.type === 'tool_use');
        const toolResults = [];
        for (const toolUse of toolUseBlocks){
            const result = await executeTool(toolUse.name, toolUse.input);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result
            });
        }
        anthropicMessages.push({
            role: 'assistant',
            content: response.content
        });
        anthropicMessages.push({
            role: 'user',
            content: toolResults
        });
        response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools,
            messages: anthropicMessages
        });
    }
    const textBlock = response.content.find((b)=>b.type === 'text');
    const text = textBlock && 'text' in textBlock ? textBlock.text : '';
    return Response.json({
        role: 'assistant',
        content: text
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0oz1cds._.js.map