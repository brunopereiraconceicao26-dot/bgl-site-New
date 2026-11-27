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

// Cidades que são basicamente data centers (Meta, Google, Amazon, Microsoft, hospedagens).
// Visitas vindas delas são robôs que se passam por navegador.
const DATACENTERS = [
  "Forest City", "Prineville", "Altoona", "Papillion", "Los Lunas", "New Albany", "Luleå", "Lulea", "Clonee", "Odense",
  "Council Bluffs", "The Dalles", "Lenoir", "Moncks Corner", "Pryor", "Mayes County", "Midlothian", "St. Ghislain", "Eemshaven",
  "Ashburn", "Boardman", "Hilliard", "Quincy", "Boydton", "San Antonio", "Cheyenne", "Des Moines",
  "Falkenstein", "Nuremberg", "Gunzenhausen", "Helsinki", "Roubaix", "Gravelines", "Strasbourg", "Kansas City", "Secaucus",
];
const DC_SQL = DATACENTERS.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");

// Provável robô (só fora do Brasil): veio de cidade de data center; ou abriu uma página só
// e saiu em menos de 2 s; ou é acesso direto de uma página só sem cidade identificada.
const ROBO = `(coalesce(pais,'') <> 'BR' AND (coalesce(cidade,'') IN (${DC_SQL})
               OR (pv = 1 AND coalesce(dur,0) < 2)
               OR (pv = 1 AND cidade IS NULL AND src = 'direto')))`;

const LOCAIS = { todos: "TRUE", br: "pais = 'BR'", ext: "coalesce(pais,'') <> 'BR'" };

// Sessões do período já classificadas; "ok" aplica os filtros escolhidos.
function base(local, robos) {
  const filtro = `${LOCAIS[local]}${robos ? "" : " AND NOT robo"}`;
  return `
  sx AS (
    SELECT session_id, min(visitor_id) AS vid, min(source) AS src, min(started_at) AS ini,
           sum(duration_s)::int AS dur, count(*)::int AS pv, min(country) AS pais, min(city) AS cidade
    FROM pageviews WHERE started_at >= now() - make_interval(days => $1)
    GROUP BY session_id),
  sf AS (SELECT *, ${ROBO} AS robo FROM sx),
  ok AS (SELECT * FROM sf WHERE ${filtro})`;
}

export default async (req) => {
  if (!senhaOk(req.headers.get("x-painel-senha"))) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ erro: "Senha incorreta" }, 401);
  }
  const url = new URL(req.url);
  let dias = Number(url.searchParams.get("dias")) || 90;
  if (!PERIODOS.has(dias)) dias = 90;
  const grao = dias > 90 ? "week" : "day";
  let local = url.searchParams.get("local") || "todos";
  if (!(local in LOCAIS)) local = "todos";
  const robos = url.searchParams.get("robos") === "1";
  const B = base(local, robos);
  const NA_SESSAO = `session_id IN (SELECT session_id FROM ok)`;

  try {
    // Mantém no máximo ~13 meses de histórico.
    await sql.query(`DELETE FROM pageviews WHERE started_at < now() - interval '400 days'`);

    const [resumo, serie, fontes, paginas, recentes, dispositivos, contagem] = await Promise.all([
      sql.query(
        `WITH ${B}
         SELECT (ini >= now() - make_interval(days => $2)) AS atual,
                count(*)::int AS sessoes, count(DISTINCT vid)::int AS visitantes,
                coalesce(sum(pv),0)::int AS paginas, coalesce(round(avg(dur)),0)::int AS tempo_medio,
                count(*) FILTER (WHERE src='google')::int AS google,
                count(*) FILTER (WHERE src='instagram')::int AS instagram,
                count(*) FILTER (WHERE pv = 1 AND dur < 10)::int AS rejeicao
         FROM ok GROUP BY 1`,
        [dias * 2, dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT to_char(date_trunc('${grao}', ini AT TIME ZONE '${TZ}'), 'YYYY-MM-DD') AS d,
                count(*) FILTER (WHERE src='google')::int AS google,
                count(*) FILTER (WHERE src='instagram')::int AS instagram,
                count(*) FILTER (WHERE src NOT IN ('google','instagram'))::int AS outros,
                count(DISTINCT vid)::int AS visitantes
         FROM ok GROUP BY 1 ORDER BY 1`,
        [dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT src, count(*)::int AS sessoes, count(DISTINCT vid)::int AS visitantes,
                round(avg(dur))::int AS tempo_medio, round(avg(pv)::numeric,1)::float AS paginas
         FROM ok GROUP BY src ORDER BY sessoes DESC`,
        [dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT path, max(title) AS titulo, count(*)::int AS views, count(DISTINCT visitor_id)::int AS visitantes,
                coalesce(round(avg(duration_s) FILTER (WHERE duration_s > 0)),0)::int AS tempo_medio,
                count(*) FILTER (WHERE source='google')::int AS google,
                count(*) FILTER (WHERE source='instagram')::int AS instagram
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1) AND ${NA_SESSAO}
         GROUP BY path ORDER BY views DESC LIMIT 40`,
        [dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT session_id, min(started_at) AS ini, min(source) AS src, min(device) AS dispositivo,
                min(city) AS cidade, min(country) AS pais, sum(duration_s)::int AS dur,
                (array_agg(referrer ORDER BY started_at))[1] AS ref,
                array_agg(json_build_object('p', path, 's', duration_s) ORDER BY started_at) AS paginas,
                bool_or(session_id IN (SELECT session_id FROM sf WHERE robo)) AS robo
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1) AND ${NA_SESSAO}
         GROUP BY session_id ORDER BY ini DESC LIMIT 50`,
        [dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT device AS d, count(DISTINCT session_id)::int AS n
         FROM pageviews WHERE started_at >= now() - make_interval(days => $1) AND ${NA_SESSAO}
         GROUP BY device ORDER BY n DESC`,
        [dias]
      ),
      sql.query(
        `WITH ${B}
         SELECT count(*) FILTER (WHERE robo)::int AS robos,
                count(*) FILTER (WHERE NOT robo AND pais = 'BR')::int AS br,
                count(*) FILTER (WHERE NOT robo AND coalesce(pais,'') <> 'BR')::int AS ext
         FROM sf`,
        [dias]
      ),
    ]);

    const vazio = { sessoes: 0, visitantes: 0, paginas: 0, tempo_medio: 0, google: 0, instagram: 0, rejeicao: 0 };
    return json({
      dias, grao, local, robos,
      contagem: contagem[0] || { robos: 0, br: 0, ext: 0 },
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
