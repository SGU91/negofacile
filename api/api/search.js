// api/search.js — Vercel Serverless Function
// Appel Anthropic avec web_search pour récupérer les offres concurrentes temps réel

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { category, query } = req.body;
  if (!category || !query) return res.status(400).json({ error: 'category et query requis' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
        messages: [{
          role: 'user',
          content: `Cherche sur le web les 3 meilleures offres concurrentes pour : ${query}.
Réponds UNIQUEMENT avec ce JSON array (sans markdown, sans texte avant ou après) :
[{"nom":"NomOffre","offre":"Description 1 ligne max","prix":"XX€/mois ou an","lien":"https://URL-directe"},{"nom":"...","offre":"...","prix":"...","lien":"..."},{"nom":"...","offre":"...","prix":"...","lien":"..."}]
Prix réels trouvés sur le web. Liens directs vers les offres ou comparateurs.`
        }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic search error:', err);
      return res.status(502).json({ error: 'Upstream error', offres: [] });
    }

    const data = await response.json();

    // Extraire le texte (ignorer server_tool_use / web_search_tool_result)
    const textBlocks = (data.content || []).filter(b => b.type === 'text');
    const raw = textBlocks.map(b => b.text).join('');

    // Parser le JSON array
    let offres = [];
    try {
      const m = raw.match(/\[[\s\S]*\]/);
      if (m) offres = JSON.parse(m[0]);
    } catch (e) {
      console.warn('JSON parse failed, raw:', raw.slice(0, 200));
    }

    // Valider structure minimale
    offres = offres.filter(o => o && o.nom).slice(0, 3);

    return res.status(200).json({ offres });

  } catch (err) {
    console.error('Search handler error:', err);
    return res.status(500).json({ error: err.message, offres: [] });
  }
}
