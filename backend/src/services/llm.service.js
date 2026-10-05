'use strict'

const config = require('../config')

const DEFAULT_BASE_URLS = {
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
}

function getConfig() {
  const { provider, apiKey, model, baseURL } = config.llm
  if (!apiKey) throw { statusCode: 503, message: 'Tính năng AI chưa được cấu hình (thiếu API key)' }
  const base = (baseURL || DEFAULT_BASE_URLS[provider] || DEFAULT_BASE_URLS.openai).replace(
    /\/$/,
    ''
  )
  return { provider, apiKey, model, base }
}

async function request(url, headers, body, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (!res.ok) {
      const err = await res.text()
      throw { statusCode: res.status, message: `AI API error: ${err}` }
    }
    return res.json()
  } catch (err) {
    if (err.name === 'AbortError') throw { statusCode: 504, message: 'AI API timeout sau 120 giây' }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function extractText(json, provider) {
  return provider === 'anthropic'
    ? json.content?.[0]?.text || ''
    : json.choices?.[0]?.message?.content || ''
}

async function callText(prompt, maxTokens = 512, timeoutMs = 120000) {
  const { provider, apiKey, model, base } = getConfig()

  if (provider === 'anthropic') {
    const json = await request(
      `${base}/v1/messages`,
      {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
      timeoutMs
    )
    return extractText(json, provider)
  }

  const json = await request(
    `${base}/chat/completions`,
    { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    timeoutMs
  )
  return extractText(json, provider)
}

async function callVision(imageBuffer, mimeType, prompt, maxTokens = 512, timeoutMs = 120000) {
  const { provider, apiKey, model, base } = getConfig()
  const base64 = imageBuffer.toString('base64')

  if (provider === 'anthropic') {
    const json = await request(
      `${base}/v1/messages`,
      {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      {
        model,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
              { type: 'text', text: prompt },
            ],
          },
        ],
      },
      timeoutMs
    )
    return extractText(json, provider)
  }

  const json = await request(
    `${base}/chat/completions`,
    { 'content-type': 'application/json', Authorization: `Bearer ${apiKey}` },
    {
      model,
      max_tokens: maxTokens,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    },
    timeoutMs
  )
  return extractText(json, provider)
}

module.exports = { callText, callVision }
