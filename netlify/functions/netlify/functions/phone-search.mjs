
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  };

  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers
    });

  if (request.method !== "GET") {
    return json(405, {
      error: "Разрешён только GET-запрос."
    });
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();

  if (query.length < 3) {
    return json(400, {
      error: "Введи запрос длиной не менее 3 символов."
    });
  }

  if (query.length > 120) {
    return json(400, {
      error: "Слишком длинный запрос."
    });
  }

  try {
    const searchUrl = new URL("https://searx.be/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("safesearch", "1");

    const response = await fetch(searchUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "SherlockAI/1.0"
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      return json(502, {
        error: "Бесплатный поисковый сервер временно недоступен. Попробуй позже."
      });
    }

    const data = await response.json();

    const results = (data.results || [])
      .slice(0, 8)
      .map(item => ({
        title: String(item.title || "Результат поиска").slice(0, 300),
        url: String(item.url || ""),
        description: String(item.content || "").slice(0, 1200),
        age: ""
      }))
      .filter(item =>
        item.url.startsWith("https://") ||
        item.url.startsWith("http://")
      );

    return json(200, {
      query,
      count: results.length,
      results
    });
  } catch {
    return json(502, {
      error: "Поиск не удался. Сервер мог ограничить запросы."
    });
  }
};
