import type { Env, Agent } from './types';

const FAL_IMAGE_ENDPOINT = 'https://fal.run/fal-ai/z-image/turbo';
const FAL_LLM_ENDPOINT = 'https://fal.run/openrouter/router';
const BANNER_TTL = 7776000; // 90 days
const MAX_BANNERS_PER_RUN = 5;

interface FalImage {
  url: string;
  width: number;
  height: number;
  content_type: string;
}

interface FalImageResponse {
  images: FalImage[];
  seed: number;
  prompt: string;
}

interface FalLLMResponse {
  output: string;
}

function kvKey(tokenAddress: string): string {
  return `banner:${tokenAddress.toLowerCase()}`;
}

/** Use an LLM to craft a creative image prompt for the agent */
async function generatePrompt(falKey: string, agent: Agent): Promise<string> {
  const context = [
    `Name: ${agent.name}`,
    `Symbol: $${agent.symbol}`,
    `Type: ${agent.type}`,
    agent.description ? `Description: ${agent.description}` : null,
    `Power Score: ${agent.powerScore.total}/100`,
  ].filter(Boolean).join('\n');

  try {
    const res = await fetch(FAL_LLM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        prompt: `You are a cinematic concept artist writing prompts for an AI image generator. Given this agent's identity, write ONE image generation prompt (2-3 sentences) for a ultra-wide cinematic banner (3:1 aspect ratio).

RULES:
- Think like a film cinematographer: depth of field, volumetric lighting, atmospheric haze, dramatic composition
- The image must be PURELY VISUAL — absolutely zero text, letters, words, numbers, symbols, logos, or typography of any kind
- Use the agent's name/description as thematic inspiration, NOT as literal text to render
- Favor abstract, atmospheric, and symbolic imagery over literal representations
- Dark moody palette: deep blacks, rich shadows, selective color accents (reds, teals, ambers)
- Think: Blade Runner establishing shots, macro photography, abstract data visualization, moody landscapes
- Vary your style — some agents could be macro/organic, others architectural, others particle-based

Output ONLY the prompt, nothing else.

${context}`,
      }),
    });

    if (!res.ok) {
      console.error(`[banners] LLM prompt failed: ${res.status}`);
      return fallbackPrompt(agent);
    }

    const result = await res.json() as FalLLMResponse;
    const prompt = result.output?.trim();

    if (!prompt || prompt.length < 20) {
      return fallbackPrompt(agent);
    }

    console.log(`[banners] LLM prompt for ${agent.symbol}: ${prompt.slice(0, 100)}...`);
    return prompt;

  } catch (err) {
    console.error(`[banners] LLM error:`, err instanceof Error ? err.message : String(err));
    return fallbackPrompt(agent);
  }
}

function fallbackPrompt(agent: Agent): string {
  const base = agent.description
    ? `${agent.name}: ${agent.description}`
    : agent.name;
  return `Cinematic ultra-wide establishing shot inspired by "${base}". Volumetric light cutting through atmospheric haze, deep blacks and selective red-amber accents, shallow depth of field. Abstract and symbolic, no text, no letters, no words, no typography. Moody, filmic, high contrast.`;
}

/** Generate a banner image via fal.ai Z-Image Turbo */
async function generateBanner(falKey: string, agent: Agent): Promise<string | null> {
  // Step 1: LLM generates a creative prompt
  const prompt = await generatePrompt(falKey, agent);

  // Step 2: Generate the image
  try {
    const res = await fetch(FAL_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: { width: 1024, height: 320 },
        num_inference_steps: 8,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'webp',
        acceleration: 'regular',
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[banners] image gen failed: ${res.status} ${body}`);
      return null;
    }

    const result = await res.json() as FalImageResponse;
    const imageUrl = result.images?.[0]?.url;

    if (!imageUrl) {
      console.error('[banners] no image in response');
      return null;
    }

    console.log(`[banners] generated banner for ${agent.symbol}: ${imageUrl.slice(0, 80)}...`);
    return imageUrl;

  } catch (err) {
    console.error(`[banners] image error for ${agent.symbol}:`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Resolve banner URLs for all agents.
 * Checks KV cache first, generates missing banners (capped per run).
 * Mutates agents in-place by setting bannerUrl.
 */
export async function resolveBanners(env: Env, agents: Agent[]): Promise<void> {
  const falKey = env.FAL_KEY;
  if (!falKey) {
    console.log('[banners] FAL_KEY not set, skipping banner generation');
    return;
  }

  // Read all cached banners in parallel
  const cacheResults = await Promise.all(
    agents.map(async (a) => {
      const cached = await env.NETWORK_KV.get(kvKey(a.tokenAddress));
      return { agent: a, cached };
    }),
  );

  // Assign cached banners, collect agents needing generation
  const needGeneration: Agent[] = [];
  let cachedCount = 0;

  for (const { agent, cached } of cacheResults) {
    if (cached) {
      agent.bannerUrl = cached;
      cachedCount++;
    } else {
      needGeneration.push(agent);
    }
  }

  // Generate missing banners in parallel (capped per run)
  const batch = needGeneration.slice(0, MAX_BANNERS_PER_RUN);
  const results = await Promise.allSettled(
    batch.map(async (agent) => {
      const url = await generateBanner(falKey, agent);
      if (url) {
        agent.bannerUrl = url;
        await env.NETWORK_KV.put(kvKey(agent.tokenAddress), url, { expirationTtl: BANNER_TTL });
      }
      return url;
    }),
  );

  const generated = results.filter((r) => r.status === 'fulfilled' && r.value).length;
  console.log(`[banners] resolved ${cachedCount} cached, ${generated} new (parallel)`);
}
