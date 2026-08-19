import { PETROL_PRICE_PER_LITRE_KOBO } from '../config/constants.js';
import { mulberry32, hashString, type Random } from './meterSimulator.js';

// Receipt vision service.
//
// Extracts fuel figures from an uploaded receipt image. When a Gemini API key
// is configured the real model is queried with an eight-second timeout; any
// failure (no key, network error, unparseable response, timeout) degrades
// gracefully to a deterministic fallback so the demo flow never blocks on an
// external service.

export interface ReceiptExtraction {
  litres: number;
  pricePerLitreKobo: number;
  confidence?: number;
}

export interface ExtractReceiptInput {
  buffer?: Buffer;
  mimeType?: string;
  geminiApiKey?: string;
  rand?: Random;
}

const TIMEOUT_MS = 8000;
const MODEL = 'gemini-1.5-flash';

export async function extractReceipt(input: ExtractReceiptInput): Promise<ReceiptExtraction> {
  if (input.geminiApiKey && input.buffer) {
    try {
      return await extractWithGemini(input.buffer, input.mimeType ?? 'image/jpeg', input.geminiApiKey);
    } catch {
      // Fall through to the deterministic mock; never block the flow.
    }
  }
  return mockExtraction(input);
}

async function extractWithGemini(buffer: Buffer, mimeType: string, apiKey: string): Promise<ReceiptExtraction> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: buffer.toString('base64'),
                },
              },
              {
                text: 'Read this fuel purchase receipt. Return JSON only: {"litres": number, "pricePerLitreKobo": number, "confidence": number}',
              },
            ],
          },
        ],
      }),
    });
    if (!response.ok) throw new Error(`Gemini responded ${response.status}`);
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return parseGeminiText(text);
  } finally {
    clearTimeout(timer);
  }
}

function parseGeminiText(text: string): ReceiptExtraction {
  const match = text.match(/\{[\s\S]*\}/);
  const raw = match ? JSON.parse(match[0]) : {};
  const litres = Number(raw.litres);
  const price = Number(raw.pricePerLitreKobo);
  const confidence = Number(raw.confidence);

  if (!Number.isFinite(litres) || litres <= 0) throw new Error('No litres in response');
  if (!Number.isFinite(price) || price <= 0) throw new Error('No price in response');

  return {
    litres: Math.round(litres * 10) / 10,
    pricePerLitreKobo: Math.round(price),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : undefined,
  };
}

/** Deterministic fallback: values in the range a jerrycan receipt shows. */
function mockExtraction(input: ExtractReceiptInput): ReceiptExtraction {
  const rand = input.rand ?? mulberry32(hashString(String(input.buffer?.length ?? Date.now())));
  const litres = Math.round((8 + rand() * 14) * 10) / 10;
  const confidence = Math.round((0.88 + rand() * 0.1) * 100) / 100;
  return {
    litres,
    pricePerLitreKobo: PETROL_PRICE_PER_LITRE_KOBO,
    confidence,
  };
}