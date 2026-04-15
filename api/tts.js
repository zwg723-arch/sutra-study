// api/tts.js — Google Cloud Text-to-Speech (Chirp 3 HD)
// Chinese: cmn-CN (China Mandarin — the only Chinese supported by Chirp 3 HD)
// Female: Sulafat | Male: Enceladus
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_TTS_API_KEY not set' });

  const { text, lang, voice } = req.body;
  if (!text) return res.status(400).json({ error: 'Missing text' });

  const isZh = !lang || lang.startsWith('zh') || lang.startsWith('cmn');
  const isMale = voice === 'male';
  const voiceName = isMale ? 'Enceladus' : 'Sulafat';

  // Chirp 3 HD supports cmn-CN for Chinese, en-US for English
  // Note: cmn-TW is NOT supported by Chirp 3 HD — must use cmn-CN
  const langCode   = isZh ? 'cmn-CN' : 'en-US';
  const fullVoice  = `${langCode}-Chirp3-HD-${voiceName}`;

  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: langCode, name: fullVoice },
          // Chirp 3 HD does NOT support speakingRate or pitch
          audioConfig: { audioEncoding: 'MP3' }
        })
      }
    );
    const data = await r.json();

    if (!r.ok) {
      console.error('Chirp3 HD error:', JSON.stringify(data.error));
      // Fallback to WaveNet/Neural2
      const fallback = isZh
        ? 'cmn-TW-Wavenet-A'
        : (isMale ? 'en-US-Neural2-D' : 'en-US-Neural2-F');
      const fbLang = isZh ? 'cmn-TW' : 'en-US';
      const r2 = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: { languageCode: fbLang, name: fallback },
            audioConfig: { audioEncoding: 'MP3', speakingRate: 0.88 }
          })
        }
      );
      const data2 = await r2.json();
      if (!r2.ok) return res.status(r2.status).json({ error: data2.error?.message || 'TTS failed' });
      return res.status(200).json({ audioContent: data2.audioContent, fallback: true });
    }

    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
