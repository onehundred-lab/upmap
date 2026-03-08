import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_HOSTS: Record<string, string> = {
  seoul: 'http://openapi.seoul.go.kr:8088',
  gangseo: 'http://openAPI.gangseo.seoul.kr:8088',
  mapo: 'http://openAPI.mapo.go.kr:8088',
  yongsan: 'http://openAPI.yongsan.go.kr:8088',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { target, path } = req.query;
  const host = ALLOWED_HOSTS[target as string];
  if (!host || !path) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const pathStr = Array.isArray(path) ? path.join('/') : path;
  const url = `${host}/${pathStr}`;

  try {
    const response = await fetch(url);
    const data = await response.text();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(data);
  } catch {
    res.status(500).json({ error: 'Proxy error' });
  }
}
