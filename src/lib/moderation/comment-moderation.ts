/**
 * Comment Moderation System
 * Uses Perspective API or OpenAI to detect toxic comments
 */

interface ModerationResult {
  isToxic: boolean;
  toxicityScore: number;
  categories?: Record<string, number>;
  shouldHide: boolean;
}

/**
 * Moderate a comment using Perspective API
 * Falls back to simple keyword-based detection if API key is not available
 */
export async function moderateComment(
  content: string
): Promise<ModerationResult> {
  const perspectiveApiKey = process.env.PERSPECTIVE_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  // Try Perspective API first
  if (perspectiveApiKey) {
    try {
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${perspectiveApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            comment: { text: content },
            requestedAttributes: {
              TOXICITY: {},
              SEVERE_TOXICITY: {},
              IDENTITY_ATTACK: {},
              INSULT: {},
              PROFANITY: {},
              THREAT: {},
            },
            languages: ["en"],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const toxicityScore =
          data.attributeScores?.TOXICITY?.summaryScore?.value || 0;
        const severeToxicityScore =
          data.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value || 0;
        const identityAttackScore =
          data.attributeScores?.IDENTITY_ATTACK?.summaryScore?.value || 0;
        const insultScore =
          data.attributeScores?.INSULT?.summaryScore?.value || 0;
        const profanityScore =
          data.attributeScores?.PROFANITY?.summaryScore?.value || 0;
        const threatScore =
          data.attributeScores?.THREAT?.summaryScore?.value || 0;

        const categories = {
          toxicity: toxicityScore,
          severe_toxicity: severeToxicityScore,
          identity_attack: identityAttackScore,
          insult: insultScore,
          profanity: profanityScore,
          threat: threatScore,
        };

        // Hide if any category exceeds threshold
        const shouldHide =
          toxicityScore > 0.7 ||
          severeToxicityScore > 0.5 ||
          identityAttackScore > 0.6 ||
          threatScore > 0.5;

        return {
          isToxic: toxicityScore > 0.5,
          toxicityScore,
          categories,
          shouldHide,
        };
      }
    } catch (error) {
      console.error("Perspective API error:", error);
    }
  }

  // Try OpenAI moderation API as fallback
  if (openAiApiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiApiKey}`,
        },
        body: JSON.stringify({ input: content }),
      });

      if (response.ok) {
        const data = await response.json();
        const result = data.results[0];

        if (result.flagged) {
          // Cast the values to number[] to satisfy Math.max types
          const scores = Object.values(result.category_scores) as number[];

          return {
            isToxic: true,
            toxicityScore: Math.max(...scores),
            categories: result.category_scores,
            shouldHide:
              result.categories.self_harm ||
              result.categories.violence ||
              result.categories.hate,
          };
        }
      }
    } catch (error) {
      console.error("OpenAI moderation API error:", error);
    }
  }

  // Fallback: Simple keyword-based detection
  return simpleKeywordDetection(content);
}

/**
 * Simple keyword-based toxic content detection (fallback)
 */
function simpleKeywordDetection(content: string): ModerationResult {
  // Explicitly type as string array
  const toxicKeywords: string[] = [
    // Add common toxic keywords here (keep it minimal for false positive reduction)
    // This is just a basic fallback
  ];

  const lowerContent = content.toLowerCase();
  let toxicCount = 0;

  for (const keyword of toxicKeywords) {
    if (lowerContent.includes(keyword)) {
      toxicCount++;
    }
  }

  // Very conservative - only flag if multiple toxic keywords found
  const isToxic = toxicCount >= 2;
  const toxicityScore = Math.min(toxicCount / 5, 1); // Normalize to 0-1

  return {
    isToxic,
    toxicityScore,
    shouldHide: isToxic && toxicityScore > 0.6,
  };
}

/**
 * Check if comment should be auto-hidden
 */
export async function shouldAutoHideComment(content: string): Promise<boolean> {
  const result = await moderateComment(content);
  return result.shouldHide;
}
