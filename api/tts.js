// api/tts.js — Google Cloud Text-to-Speech (Chirp 3 HD)
// Voices: Sulafat (female), Enceladus (male)
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

  // Chirp 3 HD voice names
  const voiceName = isMale ? 'Enceladus' : 'Sulafat';

  // Language code for Chirp 3 HD
  // Chinese Taiwan: cmn-TW, English: en-US
  const langCode = isZh ? 'cmn-TW' : 'en-US';
  const fullVoiceName = `${langCode}-Chirp3-HD-${voiceName}`;

  const requestBody = {
    input: { text },
    voice: {
      languageCode: langCode,
      name: fullVoiceName,
    },
    // Note: Chirp 3 HD does NOT support speakingRate or pitch
    audioConfig: {
      audioEncoding: 'MP3',
    }
  };

  try {
    const r = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
    const data = await r.json();

    if (!r.ok) {
      // Fallback: if Chirp 3 HD not available for this language, try WaveNet
      console.warn('Chirp3 HD failed:', JSON.stringify(data.error));
      const fallbackVoice = isZh ? 'cmn-TW-Wavenet-A' : (isMale ? 'en-US-Neural2-D' : 'en-US-Neural2-F');
      const fallbackBody = {
        input: { text },
        voice: { languageCode: langCode, name: fallbackVoice },
        audioConfig: { audioEncoding: 'MP3', speakingRate: 0.88 }
      };
      const r2 = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fallbackBody) }
      );
      const data2 = await r2.json();
      if (!r2.ok) return res.status(r2.status).json({ error: data2.error?.message || 'TTS fallback failed' });
      return res.status(200).json({ audioContent: data2.audioContent, fallback: true });
    }

    return res.status(200).json({ audioContent: data.audioContent });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
