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

/**
 * fp8 rejects json_schema (Workers AI error 5025). json_object is accepted
 * and keeps the reply as one JSON value. Nested fields are specified in the prompt.
 */
export const TACTICAL_BRIEFING_RESPONSE_FORMAT = { type: 'json_object' } as const;

export const tacticalBriefingPrompt = (matchId: string, probability: Record<string, unknown>) =>
  `Generate tactical briefing JSON for match ${matchId}. Use ONLY these engine numbers when you mention probabilities or xG. Do not invent scores or percentages:
${JSON.stringify(probability)}

Every prose field must be { "vi": "tiếng Việt", "en": "English" }.
Write vi in Vietnamese. If you cannot write Vietnamese, set vi to "" and do not copy the English sentence into vi.
homeWinProb is the home team's chance of winning. drawProb is the chance of a draw. awayWinProb is the away team's chance of winning, not of losing.
Return one JSON object and nothing else. No markdown. At most 2 items in each array.
Omit citations, source names, source URLs, and supportingSources.
Use this shape, including every nested field:
{
  "matchId": "${matchId}",
  "generatedAt": "ISO-8601",
  "summary": { "vi": "...", "en": "..." },
  "tacticalThemes": [{ "title": { "vi": "...", "en": "..." }, "detail": { "vi": "...", "en": "..." }, "confidence": 0.6 }],
  "collectiveTeamFactors": [{ "teamId": "home or away team id", "factor": { "vi": "...", "en": "..." }, "explanation": { "vi": "...", "en": "..." }, "direction": "positive", "confidence": 0.6 }],
  "lineupRisks": [{ "teamId": "home or away team id", "playerId": "player id or unspecified", "risk": { "vi": "...", "en": "..." }, "confidence": 0.5 }],
  "keyPlayers": [{ "playerId": "player id or unspecified", "reason": { "vi": "...", "en": "..." }, "impactArea": { "vi": "...", "en": "..." }, "confidence": 0.5 }],
  "probabilityExplanation": [{ "vi": "...", "en": "..." }],
  "uncertaintyNotes": [{ "vi": "...", "en": "..." }]
}
direction is only "positive", "negative", or "neutral". confidence is a number from 0 to 1.
probabilityExplanation must contain at least one takeaway, and summary must be non-empty.`;
