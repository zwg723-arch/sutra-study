// api/line-callback.js
// LINE Login OAuth 2.0 callback handler
//
// 【Vercel 環境變數（需設定）】:
//   LINE_CHANNEL_ID     — LINE Login Channel ID
//   LINE_CHANNEL_SECRET — LINE Login Channel Secret
//   LINE_REDIRECT_URI   — 完整的 callback URL，例如:
//                         https://sutra-study.vercel.app/api/line-callback
//
// 【LINE Developer Console 設定】:
//   1. https://developers.line.biz → 建立 LINE Login channel
//   2. Callback URL 填入: https://sutra-study.vercel.app/api/line-callback

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { code, state, error, error_description } = req.query;

  // LINE returned an error
  if (error) {
    const msg = error_description || error;
    return res.redirect('/?line_error=' + encodeURIComponent(msg));
  }

  if (!code) {
    return res.redirect('/?line_error=' + encodeURIComponent('missing_code'));
  }

  const channelId     = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelId || !channelSecret) {
    return res.redirect('/?line_error=' + encodeURIComponent('server_not_configured'));
  }

  // Build redirect_uri — prefer env var, fallback to request host
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host  = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = process.env.LINE_REDIRECT_URI
    || `${proto}://${host}/api/line-callback`;

  try {
    // ── Step 1: Exchange code for access token ──
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code:          code,
        redirect_uri:  redirectUri,
        client_id:     channelId,
        client_secret: channelSecret,
      }).toString(),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      const errMsg = tokenData.error_description || tokenData.error || 'token_failed';
      return res.redirect('/?line_error=' + encodeURIComponent(errMsg));
    }

    // ── Step 2: Get user profile ──
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileRes.json();

    if (!profile.userId) {
      return res.redirect('/?line_error=' + encodeURIComponent('profile_failed'));
    }

    // ── Step 3: Redirect back to app with user info ──
    const params = new URLSearchParams({
      line_user: profile.displayName  || 'LINE用戶',
      line_pic:  profile.pictureUrl   || '',
      line_id:   profile.userId,
    });

    return res.redirect('/?' + params.toString());

  } catch (err) {
    console.error('LINE callback error:', err);
    return res.redirect('/?line_error=' + encodeURIComponent(err.message || 'unknown'));
  }
}
