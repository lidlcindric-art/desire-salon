import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const PREFIX = 'desire'; // namespace – dijeli Redis s Beauty Mess

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isAdmin = req.headers['x-admin-key'] === process.env.ADMIN_KEY;

  if (req.method === 'GET') {
    const { date, view } = req.query;
    if (view === 'slots' && date) {
      const taken = await redis.smembers(`${PREFIX}:slots:${date}`) || [];
      return res.json({ slots: taken });
    }
    if (isAdmin) {
      const keys = await redis.keys(`${PREFIX}:appt:*`);
      if (!keys.length) return res.json({ appointments: [] });
      const appts = await redis.mget(...keys);
      const list = appts.filter(Boolean).map(a => typeof a === 'string' ? JSON.parse(a) : a)
        .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
      return res.json({ appointments: list });
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { name, phone, email, service, date, time, note } = req.body;
    if (!name || !phone || !service || !date || !time)
      return res.status(400).json({ error: 'Nedostaju obavezni podaci' });
    const taken = await redis.sismember(`${PREFIX}:slots:${date}`, time);
    if (taken) return res.status(409).json({ error: 'Termin je već zauzet' });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const appt = { id, name, phone, email: email||'', service, date, time,
      datetime: `${date}T${time}`, note: note||'', createdAt: new Date().toISOString(), status: 'pending' };
    await redis.set(`${PREFIX}:appt:${id}`, JSON.stringify(appt));
    await redis.sadd(`${PREFIX}:slots:${date}`, time);
    await redis.expire(`${PREFIX}:slots:${date}`, 60*60*24*90);
    if (process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
          body: JSON.stringify({ from: 'Desire Salon <noreply@desire-salon.hr>', to: process.env.OWNER_EMAIL,
            subject: `⏳ Nova rezervacija — ${name} · ${date} u ${time}`,
            html: `<h2>Nova rezervacija čeka potvrdu!</h2><p><b>${name}</b> · ${phone} · ${service} · ${date} u ${time}</p>` })
        });
      } catch(e) {}
    }
    return res.status(201).json({ success: true, appointment: appt });
  }

  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.query;
    const raw = await redis.get(`${PREFIX}:appt:${id}`);
    if (!raw) return res.status(404).json({ error: 'Termin nije pronađen' });
    const appt = typeof raw === 'string' ? JSON.parse(raw) : raw;
    appt.status = 'confirmed'; appt.confirmedAt = new Date().toISOString();
    await redis.set(`${PREFIX}:appt:${id}`, JSON.stringify(appt));
    return res.json({ success: true, appointment: appt });
  }

  if (req.method === 'DELETE') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.query;
    const raw = await redis.get(`${PREFIX}:appt:${id}`);
    if (!raw) return res.status(404).json({ error: 'Termin nije pronađen' });
    const appt = typeof raw === 'string' ? JSON.parse(raw) : raw;
    await redis.del(`${PREFIX}:appt:${id}`);
    await redis.srem(`${PREFIX}:slots:${appt.date}`, appt.time);
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
