// Recebe as visitas do site (assets/track.js) e grava no banco de estatísticas.
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.ANALYTICS_DATABASE_URL);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-z0-9-]{8,40}$/i;
const FONTES = new Set(["google", "instagram", "facebook", "linkedin", "whatsapp", "bing", "youtube", "direto", "outros"]);
const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp\/|monitor|curl|python|wget/i;

const vazio = () => new Response(null, { status: 204 });
const corta = (v, n) => (typeof v === "string" ? v.slice(0, n) : null);

function dispositivo(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|android/i.test(ua)) return "celular";
  return "computador";
}

export default async (req, context) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const ua = req.headers.get("user-agent") || "";
  if (!ua || BOTS.test(ua.replace(/Instagram|FBAN|FBAV/g, ""))) return vazio();

  let b;
  try { b = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }
  if (!b || !UUID.test(b.id || "")) return new Response(null, { status: 400 });

  try {
    if (b.t === "v") {
      if (!ID.test(b.vid || "") || !ID.test(b.sid || "")) return new Response(null, { status: 400 });
      const fonte = FONTES.has(b.src) ? b.src : "outros";
      const caminho = (corta(b.path, 200) || "/").replace(/[^\w\-./#]/g, "");
      await sql.query(
        `INSERT INTO pageviews (id, visitor_id, session_id, path, title, source, referrer, device, country, city)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
        [b.id, b.vid, b.sid, caminho, corta(b.title, 160), fonte, corta(b.ref, 200),
         dispositivo(ua), context.geo?.country?.code || null, corta(context.geo?.city, 80)]
      );
    } else if (b.t === "d") {
      const s = Math.max(0, Math.min(1800, Math.round(Number(b.d) || 0)));
      await sql.query(
        `UPDATE pageviews SET duration_s = GREATEST(duration_s, $2)
         WHERE id = $1 AND started_at > now() - interval '1 day'`,
        [b.id, s]
      );
    }
  } catch (e) {
    console.error("track", e);
  }
  return vazio();
};

export const config = { path: "/api/track" };
