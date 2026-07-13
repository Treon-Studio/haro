import type { ToolDefinition, ToolExecutor } from './assistant.types'

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        recency_days: { type: 'number', description: 'Limit to past days. Optional.' },
      },
      required: ['query'],
    },
  },
}

export const IMAGE_GENERATION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'image_generation',
    description: 'Generate an image from a text description',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Text description of the image' },
        aspect_ratio: { type: 'string', enum: ['1:1', '16:9', '9:16', '4:3'] },
      },
      required: ['prompt'],
    },
  },
}

export const webSearchExecutor: ToolExecutor = async (args) => {
  const query = String(args.query || '')
  const recencyDays = typeof args.recency_days === 'number' ? args.recency_days : undefined
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!response.ok) throw new Error('Search failed')

    const data: any = await response.json()
    const results: string[] = []

    if (data.AbstractText) {
      results.push(`Source: ${data.AbstractURL || 'Unknown'}\n${data.AbstractText}`)
    }
    if (data.RelatedTopics?.length > 0) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push(`- ${topic.Text}${topic.FirstURL ? ` (${topic.FirstURL})` : ''}`)
        }
      }
    }
    if (results.length === 0 && data.AnswerType) {
      results.push(`Answer: ${data.Answer}`)
    }

    return results.length > 0
      ? results.join('\n\n')
      : JSON.stringify({ query, message: 'No results found', recency_days: recencyDays })
  } catch {
    return JSON.stringify({ query, error: 'Web search failed. Please try again.' })
  }
}

export function createImageGenerationExecutor(apiKey: string): ToolExecutor {
  return async (args) => {
    const prompt = String(args.prompt || '')
    const aspectRatio = typeof args.aspect_ratio === 'string' ? args.aspect_ratio : '1:1'
    if (!apiKey) {
      return JSON.stringify({ error: 'Image generation is not configured on the server' })
    }

    const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'blackforest-labs/flux-schnell',
        prompt,
        aspect_ratio: aspectRatio,
        steps: 4,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return JSON.stringify({ error: `Image generation failed: ${err}` })
    }

    const data: any = await response.json()
    return JSON.stringify({ imageUrl: data.data?.[0]?.url, revisedPrompt: data.data?.[0]?.revised_prompt })
  }
}
