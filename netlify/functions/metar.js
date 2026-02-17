// Netlify Function: /.netlify/functions/metar?ids=LTFM,LTAC
export async function handler(event) {
    try {
      const idsRaw = event.queryStringParameters?.ids || "LTFM";
      const ids = idsRaw
        .split(",")
        .map(s => s.trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 10) // abartmayalım
  
      const upstream =
        `https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids.join(","))}&format=json`;
  
      const resp = await fetch(upstream);
  
      // upstream hata döndürürse aynen geçir
      const text = await resp.text();
  
      return {
        statusCode: resp.status,
        headers: {
          "content-type": "application/json; charset=utf-8",
          // 60 sn cache (istersen 0 yap)
          "cache-control": "public, max-age=60",
          "access-control-allow-origin": "*",
        },
        body: text,
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ error: String(err) }),
      };
    }
  }
  