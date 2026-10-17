
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

    const digits = query.replace(/\D/g, "");
    const isPhone = digits.length >= 7 && digits.length <= 15;
    const variants = isPhone
      ? [...new Set([query, digits, "+" + digits])]
      : [query];

    const collected = [];
    const errors = [];

    for (const variant of variants) {
      const searchUrl = new URL("https://plumbsearch.org/search");
      searchUrl.searchParams.set("q", variant);
      searchUrl.searchParams.set("format", "json");

      try {
        const response = await fetch(searchUrl, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
          errors.push("HTTP " + response.status);
          continue;
        }

        const data = await response.json();

        for (const item of data.results || []) {
          if (!item.title || !item.url) continue;

          let parsed;
          try {
            parsed = new URL(item.url);
          } catch {
            continue;
          }

          if (!["https:", "http:"].includes(parsed.protocol)) continue;

          const title = String(item.title);
          const snippet = String(item.content || item.snippet || "");
          const textDigits = (title + " " + snippet).replace(/\D/g, "");

          // Для телефона нужны совпадения в тексте результата.
          if (isPhone && !textDigits.includes(digits)) continue;

          const spam = /casino bonus|betting tips|ganhe até|clique para ganhar/i;
          if (spam.test(title + " " + snippet)) continue;

          collected.push({
            title: title.trim(),
            url: parsed.href,
            snippet: snippet.trim()
          });
        }
      } catch (error) {
        errors.push(
          error.name === "TimeoutError" ? "Тайм-аут" : "Ошибка соединения"
        );
      }
    }

    const seen = new Set();
    const results = collected.filter(item => {
      const key = item.url.toLowerCase().replace(/\/$/, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);

    return respond(200, {
      query,
      count: results.length,
      results,
      message: results.length
        ? "Найдены страницы с совпадением в тексте результата"
        : errors.length
          ? "Поисковый сервис не ответил. Попробуйте позже."
          : "Точных совпадений в заголовках и описаниях не найдено.",
      warning: isPhone
        ? "Отсутствие совпадений не означает, что номер нигде не опубликован."
        : "Результаты требуют самостоятельной проверки."
    });
  } catch (error) {
    return respond(502, {
      error: "Ошибка публичного поиска",
      details: error.message || "Поисковый сервер не ответил"
    });
  }
};
