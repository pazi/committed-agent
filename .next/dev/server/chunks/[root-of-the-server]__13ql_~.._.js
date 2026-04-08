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
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[project]/src/lib/bigquery.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DATASET",
    ()=>DATASET,
    "bigquery",
    ()=>bigquery
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$dotenv$2f$config$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/dotenv/config.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$google$2d$cloud$2f$bigquery__$5b$external$5d$__$2840$google$2d$cloud$2f$bigquery$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$google$2d$cloud$2f$bigquery$29$__ = __turbopack_context__.i("[externals]/@google-cloud/bigquery [external] (@google-cloud/bigquery, cjs, [project]/node_modules/@google-cloud/bigquery)");
;
;
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
const dataset = process.env.BIGQUERY_DATASET ?? 'supermetrics_data';
if (!projectId) {
    throw new Error('Missing GOOGLE_CLOUD_PROJECT in environment variables. ' + 'Copy .env.example to .env and fill in your GCP project ID.');
}
const bigquery = new __TURBOPACK__imported__module__$5b$externals$5d2f40$google$2d$cloud$2f$bigquery__$5b$external$5d$__$2840$google$2d$cloud$2f$bigquery$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$google$2d$cloud$2f$bigquery$29$__["BigQuery"]({
    projectId
});
const DATASET = dataset;
}),
"[project]/src/services/bigquery.service.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAdGroupPerformance",
    ()=>getAdGroupPerformance,
    "getCampaignPerformance",
    ()=>getCampaignPerformance,
    "getDateTrend",
    ()=>getDateTrend,
    "getDevicePerformance",
    ()=>getDevicePerformance
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/bigquery.ts [app-route] (ecmascript)");
;
// ============================================
// Helpers
// ============================================
function parseBQDate(d) {
    if (d && typeof d === 'object' && 'value' in d) {
        return String(d.value);
    }
    return String(d ?? '');
}
function num(v) {
    return Number(v ?? 0);
}
function computeMetrics(row) {
    return {
        ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
        cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
        cpm: row.impressions > 0 ? row.cost / row.impressions * 1000 : 0,
        roas: row.cost > 0 ? row.conversion_value / row.cost : 0
    };
}
async function getCampaignPerformance(days = 30) {
    const query = `
    SELECT
      CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_STATUS,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DATASET"]}.GOOGLEADS_AD\`
    WHERE DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY CAMPAIGN_ID, CAMPAIGN_NAME, CAMPAIGN_STATUS
    ORDER BY cost DESC
  `;
    const [rows] = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bigquery"].query({
        query,
        params: {
            days
        },
        location: 'EU'
    });
    return rows.map((r)=>{
        const base = {
            campaign_id: String(r.CAMPAIGN_ID),
            campaign_name: String(r.CAMPAIGN_NAME),
            campaign_status: String(r.CAMPAIGN_STATUS),
            impressions: num(r.impressions),
            clicks: num(r.clicks),
            cost: num(r.cost),
            conversions: num(r.conversions),
            conversion_value: num(r.conversion_value)
        };
        return {
            ...base,
            ...computeMetrics(base)
        };
    });
}
async function getAdGroupPerformance(campaignId, days = 30) {
    const query = `
    SELECT
      AD_GROUP_ID, AD_GROUP_NAME, AD_GROUP_STATUS, CAMPAIGN_NAME,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DATASET"]}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY AD_GROUP_ID, AD_GROUP_NAME, AD_GROUP_STATUS, CAMPAIGN_NAME
    ORDER BY cost DESC
  `;
    const [rows] = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bigquery"].query({
        query,
        params: {
            campaignId,
            days
        },
        location: 'EU'
    });
    return rows.map((r)=>{
        const base = {
            ad_group_id: String(r.AD_GROUP_ID),
            ad_group_name: String(r.AD_GROUP_NAME),
            ad_group_status: String(r.AD_GROUP_STATUS),
            campaign_name: String(r.CAMPAIGN_NAME),
            impressions: num(r.impressions),
            clicks: num(r.clicks),
            cost: num(r.cost),
            conversions: num(r.conversions),
            conversion_value: num(r.conversion_value)
        };
        return {
            ...base,
            ...computeMetrics(base)
        };
    });
}
async function getDevicePerformance(campaignId, days = 30) {
    const query = `
    SELECT
      DEVICE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions
    FROM \`${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DATASET"]}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY DEVICE
    ORDER BY cost DESC
  `;
    const [rows] = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bigquery"].query({
        query,
        params: {
            campaignId,
            days
        },
        location: 'EU'
    });
    return rows.map((r)=>{
        const base = {
            device: String(r.DEVICE),
            impressions: num(r.impressions),
            clicks: num(r.clicks),
            cost: num(r.cost),
            conversions: num(r.conversions)
        };
        return {
            ...base,
            ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
            cpc: base.clicks > 0 ? base.cost / base.clicks : 0,
            cpm: base.impressions > 0 ? base.cost / base.impressions * 1000 : 0
        };
    });
}
async function getDateTrend(campaignId, days = 30) {
    const query = `
    SELECT
      DATE,
      SUM(IMPRESSIONS) as impressions,
      SUM(CLICKS) as clicks,
      SUM(COST) as cost,
      SUM(CONVERSIONS) as conversions,
      SUM(CONVERSION_VALUE) as conversion_value
    FROM \`${__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DATASET"]}.GOOGLEADS_AD\`
    WHERE CAMPAIGN_ID = @campaignId
      AND DATE >= DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY)
    GROUP BY DATE
    ORDER BY DATE ASC
  `;
    const [rows] = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$bigquery$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bigquery"].query({
        query,
        params: {
            campaignId,
            days
        },
        location: 'EU'
    });
    return rows.map((r)=>{
        const base = {
            date: parseBQDate(r.DATE),
            impressions: num(r.impressions),
            clicks: num(r.clicks),
            cost: num(r.cost),
            conversions: num(r.conversions),
            conversion_value: num(r.conversion_value)
        };
        return {
            ...base,
            ctr: base.impressions > 0 ? base.clicks / base.impressions : 0,
            cpc: base.clicks > 0 ? base.cost / base.clicks : 0
        };
    });
}
}),
"[project]/app/api/chat/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$index$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/index.mjs [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__ = __turbopack_context__.i("[project]/node_modules/@anthropic-ai/sdk/client.mjs [app-route] (ecmascript) <export Anthropic as default>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bigquery$2e$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/bigquery.service.ts [app-route] (ecmascript)");
;
;
const anthropic = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$anthropic$2d$ai$2f$sdk$2f$client$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$export__Anthropic__as__default$3e$__["default"]({
    apiKey: process.env.ANTHROPIC_API_KEY
});
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
                const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bigquery$2e$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getCampaignPerformance"])(input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_adgroup_performance':
            {
                const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bigquery$2e$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAdGroupPerformance"])(input.campaign_id, input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_device_breakdown':
            {
                const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bigquery$2e$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDevicePerformance"])(input.campaign_id, input.days ?? 30);
                return JSON.stringify(data, null, 2);
            }
        case 'get_date_trend':
            {
                const data = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$bigquery$2e$service$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDateTrend"])(input.campaign_id, input.days ?? 30);
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

//# sourceMappingURL=%5Broot-of-the-server%5D__13ql_~.._.js.map