// api/tts.js — Google Cloud Text-to-Speech proxy
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_TTS_API_KEY not set' });

  const { text, lang } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const isZh = !lang || lang.startsWith('zh');

  // zh-TW-Neural2-A does NOT exist.
  // Correct TW Chinese WaveNet: languageCode=cmn-TW, name=cmn-TW-Wavenet-A
  const voiceConfig = isZh
    ? { languageCode: 'cmn-TW', name: 'cmn-TW-Wavenet-A' }
    : { languageCode: 'en-US', name: 'en-US-Neural2-F' };

  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: voiceConfig,
          audioConfig: { audioEncoding: 'MP3', speakingRate: 0.88, pitch: 0 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) {
      console.error('TTS error:', JSON.stringify(data));
      return res.status(r.status).json({ error: data.error?.message || 'TTS failed', detail: data });
    }
    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
