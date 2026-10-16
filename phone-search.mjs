export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  };
  const json = (statusCode, body) =>
    new Response(JSON.stringify(body), { status: statusCode, headers });

  if (request.method !== "GET") {
    return json(405, { error: "Разрешён только GET-запрос." });
  }

  const apiKey = Netlify.env.get("BRAVE_SEARCH_API_KEY");
  if (!apiKey) {
    return json(503, {
      error: "Не настроен поисковый API-ключ. В Netlify открой Site configuration → Environment variables и добавь BRAVE_SEARCH_API_KEY."
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  if (!query || query.length < 3) {
    return json(400, { error: "Введи номер или запрос длиной не менее 3 символов." });
  }
  if (query.length > 120) {
    return json(400, { error: "Слишком длинный запрос." });
  }

  try {
    const searchUrl = new URL("https://api.search.brave.com/res/v1/web/search");
    searchUrl.searchParams.set("q", `"${query}"`);
    searchUrl.searchParams.set("count", "8");
    searchUrl.searchParams.set("safesearch", "moderate");

    const upstream = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });

    if (!upstream.ok) {
      const detail = upstream.status === 401 || upstream.status === 403
        ? "Поисковый API-ключ неверен или не имеет доступа. Проверь BRAVE_SEARCH_API_KEY."
        : upstream.status === 429
          ? "Лимит поискового API исчерпан. Попробуй позже."
          : `Поисковый сервис вернул HTTP ${upstream.status}.`;
      return json(upstream.status === 429 ? 429 : 502, { error: detail });
    }

    const data = await upstream.json();
    const results = (data.web?.results || []).slice(0, 8).map(item => ({
      title: String(item.title || "Результат поиска").slice(0, 300),
      url: String(item.url || ""),
      description: String(item.description || "").slice(0, 1200),
      age: String(item.page_age || "")
    })).filter(item => item.url.startsWith("https://") || item.url.startsWith("http://"));

    return json(200, { query, count: results.length, results });
  } catch {
    return json(502, { error: "Не удалось связаться с поисковым API. Проверь соединение и настройки Netlify." });
  }
};
