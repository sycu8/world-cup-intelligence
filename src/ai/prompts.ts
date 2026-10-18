export const SYSTEM_NO_INVENT_NUMBERS = `You are a football tactical analyst.
CRITICAL: Never invent numeric win probabilities, xG, or scores. Only explain numbers provided by the statistical engine.
Cite uncertainty when source confidence is low. Output valid JSON when asked.
All user-facing text fields must be bilingual objects: { "vi": "...", "en": "..." }. Write natural Vietnamese (vi) first; English (en) is a faithful translation.`;

export const multiVariableSynthesisPrompt = (ctx: Record<string, unknown>) =>
  `Synthesize a multi-factor World Cup match analysis from these structured inputs (all variables pre-computed by the statistical engine and data pipeline):

${JSON.stringify(ctx, null, 2)}

Return JSON:
{
  "matchId": string,
  "generatedAt": string,
  "executiveSummary": string,
  "variableInsights": [{"variable": string, "impact": "high"|"medium"|"low", "direction": string, "explanation": string}],
  "tacticalRecommendations": [string],
  "riskFactors": [string],
  "confidence": number
}`;

export const entityExtractPrompt = (text: string) =>
  `Extract from this football article (JSON only):
{
  "teams": string[],
  "players": string[],
  "injuries": string[],
  "tacticalNotes": string[],
  "formations": string[]
}
Article:
${text.slice(0, 3000)}`;

export const tacticalBriefingPrompt = (matchId: string, probability: Record<string, unknown>) =>
  `Generate tactical briefing JSON for match ${matchId}. Use ONLY these model outputs for probability fields:
${JSON.stringify(probability)}

Every text field (summary, tacticalThemes.title/detail, collectiveTeamFactors.factor/explanation, lineupRisks.risk, keyPlayers.reason/impactArea, probabilityExplanation items, uncertaintyNotes items) MUST be:
{ "vi": "tiếng Việt", "en": "English" }

Schema: matchId, generatedAt (ISO), summary, tacticalThemes[], collectiveTeamFactors[], lineupRisks[], keyPlayers[], probabilityExplanation[], uncertaintyNotes[], citations[] (sourceName may stay English).
Output one JSON object only, with no markdown and no commentary.
Keep each array to at most 2 items.`;
