export default function handler(req: any, res: any) {
  let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown IP';
  if (Array.isArray(ip)) ip = ip[0];
  if (typeof ip === 'string' && ip.includes(',')) ip = ip.split(',')[0].trim();
  res.status(200).json({ ip });
}
