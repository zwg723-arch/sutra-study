// api/github-push.js
// Vercel serverless function — receives new HTML content and pushes to GitHub
// Environment variables needed:
//   GITHUB_TOKEN       — Personal Access Token (repo scope)
//   GITHUB_OWNER       — your GitHub username
//   GITHUB_REPO        — repository name (e.g. "sutra-study")
//   PUSH_SECRET        — a random password you choose to protect this endpoint

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, content, filename = 'index.html', message = 'Update via Claude mobile' } = req.body;

  // 驗證密碼
  if (secret !== process.env.PUSH_SECRET) {
    return res.status(403).json({ error: '密碼錯誤' });
  }

  if (!content || content.length < 100) {
    return res.status(400).json({ error: '內容太短，請確認有貼上 HTML' });
  }

  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  if (!owner || !repo || !token) {
    return res.status(500).json({ error: 'GitHub 環境變數未設定' });
  }

  try {
    // Step 1: Get current file SHA (needed for update)
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
      { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } }
    );

    let sha = null;
    if (getRes.ok) {
      const fileData = await getRes.json();
      sha = fileData.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      return res.status(500).json({ error: 'GitHub 取得檔案失敗: ' + (err.message || getRes.status) });
    }

    // Step 2: Push the update
    const body = {
      message: `🤖 ${message} — ${new Date().toLocaleString('zh-TW', {timeZone:'Asia/Taipei'})}`,
      content: Buffer.from(content, 'utf8').toString('base64'),
    };
    if (sha) body.sha = sha;

    const pushRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!pushRes.ok) {
      const err = await pushRes.json();
      return res.status(500).json({ error: 'GitHub 推送失敗: ' + (err.message || pushRes.status) });
    }

    const result = await pushRes.json();
    return res.status(200).json({
      success: true,
      message: '✅ 推送成功！Vercel 將在約 1 分鐘內自動重新部署。',
      commit: result.commit?.html_url || '',
      sha: result.content?.sha?.substring(0, 7) || '',
    });

  } catch (err) {
    return res.status(500).json({ error: '伺服器錯誤: ' + err.message });
  }
}
