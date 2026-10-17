
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const respond = (status, data) =>
    new Response(JSON.stringify(data), { status, headers });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (!["GET", "POST"].includes(request.method)) {
    return respond(405, { error: "Method not allowed" });
  }

  try {
    const url = new URL(request.url);
    let query =
      url.searchParams.get("q") ||
      url.searchParams.get("phone") ||
      "";

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

    const digits = query.replace(/\D/g, "");
    const isPhone = digits.length >= 7 && digits.length <= 15;
    const queries = isPhone
      ? [...new Set([query, digits, "+" + digits])]
      : [query];

    const allResults = [];
    const errors = [];

    for (const searchQuery of queries) {
      const searchUrl = new URL("https://plumbsearch.org/search");
      searchUrl.searchParams.set("q", searchQuery);
      searchUrl.searchParams.set("format", "json");

      try {
        const response = await fetch(searchUrl, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          errors.push("HTTP " + response.status);
          continue;
        }

        const data = await response.json();

        for (const item of data.results || []) {
          if (!item.url || !item.title) continue;

          let parsedUrl;
          try {
            parsedUrl = new URL(item.url);
          } catch {
            continue;
          }

          if (!["http:", "https:"].includes(parsedUrl.protocol)) continue;

          const title = String(item.title).trim();
          const snippet = String(item.content || item.snippet || "").trim();

          if (!title) continue;

          const combined = (title + " " + snippet).toLowerCase();
          const spamWords = [
            "win money", "casino bonus", "betting tips",
            "ganhe até", "clique para ganhar"
          ];

          if (spamWords.some(word => combined.includes(word))) continue;

          allResults.push({
            title,
            url: parsedUrl.href,
            snippet
          });
        }
      } catch (error) {
        errors.push(
          error.name === "TimeoutError" ? "Тайм-аут поиска" : "Ошибка соединения"
        );
      }
    }

    const seen = new Set();
    const results = [];

    for (const item of allResults) {
      const key = item.url
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/$/, "");

      if (seen.has(key)) continue;
      seen.add(key);

      results.push(item);
    }

    return respond(200, {
      query,
      count: results.length,
      results: results.slice(0, 10),
      message: results.length
        ? "Найдены публичные страницы. Проверь каждое совпадение вручную."
        : errors.length
          ? "Поисковый сервис временно не вернул результаты."
          : "Подходящие публичные страницы не найдены.",
      warning: isPhone
        ? "Результаты не подтверждают владельца или активность номера."
        : "Результаты поиска требуют самостоятельной проверки."
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
