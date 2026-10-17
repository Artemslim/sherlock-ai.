
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const respond = (status, data) =>
    new Response(JSON.stringify(data), {
      status,
      headers
    });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(request.url);
    let query = url.searchParams.get("q") ||
                url.searchParams.get("phone") || "";

    if (request.method === "POST") {
      const body = await request.json();
      query = body.q || body.phone || query;
    }

    query = String(query).trim();

    if (!query) {
      return respond(400, { error: "Укажите поисковый запрос" });
    }

    if (query.length > 200) {
      return respond(400, { error: "Запрос слишком длинный" });
    }

    const searchUrl = new URL("https://plumbsearch.org/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");

    const response = await fetch(searchUrl, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      return respond(502, {
        error: "Поисковый сервер недоступен",
        providerStatus: response.status
      });
    }

    const data = await response.json();
    const results = (data.results || [])
      .slice(0, 10)
      .map(item => ({
        title: item.title || "",
        url: item.url || "",
        snippet: item.content || item.snippet || ""
      }))
      .filter(item => item.title && item.url);

    return respond(200, {
      query,
      count: results.length,
      results,
      message: results.length
        ? "Найдены публичные страницы"
        : "Результаты не найдены"
    });
  } catch (error) {
    return respond(502, {
      error: "Ошибка публичного поиска",
      details: error.name === "TimeoutError"
        ? "Истекло время ожидания"
        : error.message || "Поисковый сервер не ответил"
    });
  }
};
