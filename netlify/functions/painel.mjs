// Dados do painel de visitantes (painel.html). Exige a senha definida em PAINEL_SENHA.
import { neon } from "@neondatabase/serverless";
import { timingSafeEqual, createHash } from "node:crypto";

const sql = neon(process.env.ANALYTICS_DATABASE_URL);
const PERIODOS = new Set([7, 30, 90, 180, 365]);
const TZ = "America/Sao_Paulo";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });

function senhaOk(dada) {
  const certa = process.env.PAINEL_SENHA || "";
  if (!certa || !dada) return false;
  const h = (s) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(dada), h(certa));
}

// Uma linha por sessão (visita): origem, visitante, páginas e tempo total.
const SESSOES = `
  SELECT session_id, min(visitor_id) AS vid, min(source) AS src, min(started_at) AS ini,
         sum(duration_s)::int AS dur, count(*)::int AS pv
  FROM pageviews WHERE started_at >= now() - make_interval(days => $1)
  GROUP BY session_id`;

export default async (req) => {
  if (!senhaOk(req.headers.get("x-painel-senha"))) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ erro: "Senha incorreta" }, 401);
  }
  const url = new URL(req.url);
  let dias = Number(url.searchParams.get("dias")) || 90;
  if (!PERIODOS.has(dias)) dias = 90;
  const grao = dias > 90 ? "week" : "day";

  try {
    // Mantém no máximo ~13 meses de histórico.
    await sql.query(`DELETE FROM pageviews WHERE started_at < now() - interval '400 days'`);

    const [resumo, serie, fontes, paginas, recentes, dispositivos] = await Promise.all([
      sql.query(
        `WITH s AS (${SESSOES})
         SELECT (ini >= now() - make_interval(days => $2)) AS atual,
                count(*)::int AS sessoes, count(DISTINCT vid)::int AS visitantes,
                coalesce(sum(pv),0)::int AS paginas, coalesce(round(avg(dur)),0)::int AS tempo_medio,
                count(*) FILTER (WHERE src='google')::int AS google,
                count(*) FILTER (WHERE src='instagram')::int AS instagram,
                count(*) FILTER (WHERE pv = 1 AND dur < 10)::int AS rejeicao
         FROM s GROUP BY 1`,
        [dias * 2, dias]
      ),
      sql.query(
        `WITH s AS (${SESSOES})
         SELECT to_char(date_trunc('${grao}', ini AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS d,
                count(*) FILTER (WHERE src='google')::int AS google,
                count(*) FILTER (WHERE src='instagram')::int AS instagram,
                count(*) FILTER (WHERE src NOT IN ('google','instagram'))::int AS outros,
                count(DISTINCT vid)::int AS visitantes
         FROM s GROUP BY 1 ORDER BY 1`,
        [dias]
      ),
      sql.query(
        `WITH s AS (${SESSOES})
         SELECT src, count(*)::int AS sessoes, count(DISTINCT vid)::int AS visitantes,
                round(avg(dur))::int AS tempo_medio, round(avg(pv)::numeric,1)::float AS paginas
         FROM s GROUP BY src ORDER BY sessoes DESC`,
        [dias]
      ),
      sql.query(
        `SELECT path, max(title) AS titulo, count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitantes,
                coalesce(round(avg(duration_s) FILTER (WHERE duration_s > 0)),0)::int AS tempo_medio,
                count(*) FILTER (WHERE source='google')::int AS google,
                count(*) FILTER (WHERE source='instagram')::int AS instagram
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1)
         GROUP BY path ORDER BY views DESC LIMIT 40`,
        [dias]
      ),
      sql.query(
        `SELECT session_id, min(started_at) AS ini, min(source) AS src, min(device) AS dispositivo,
                min(city) AS cidade, min(country) AS pais, sum(duration_s)::int AS dur,
                (array_agg(referrer ORDER BY started_at))[1] AS ref,
                array_agg(json_build_object('p', path, 's', duration_s) ORDER BY started_at) AS paginas
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1)
         GROUP BY session_id ORDER BY ini DESC LIMIT 50`,
        [dias]
      ),
      sql.query(
        `SELECT device AS d, count(DISTINCT session_id)::int AS n
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1)
         GROUP BY device ORDER BY n DESC`,
        [dias]
      ),
    ]);

    const vazio = { sessoes: 0, visitantes: 0, paginas: 0, tempo_medio: 0, google: 0, instagram: 0, rejeicao: 0 };
    return json({
      dias, grao,
      atual: resumo.find((r) => r.atual) || vazio,
      anterior: resumo.find((r) => !r.atual) || vazio,
      serie, fontes, paginas, recentes, dispositivos,
      gerado: new Date().toISOString(),
    });
  } catch (e) {
    console.error("painel", e);
    return json({ erro: "Falha ao consultar o banco" }, 500);
  }
};

export const config = { path: "/api/painel" };
