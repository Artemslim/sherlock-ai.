
export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };

  const respond = (statusCode, data) =>
    new Response(JSON.stringify(data), {
      status: statusCode,
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
    let phone = url.searchParams.get("phone") || url.searchParams.get("q") || "";

    if (request.method === "POST") {
      const body = await request.json();
      phone = body.phone || "";
    }

    phone = String(phone).trim();

    if (!phone) {
      return respond(400, { error: "Укажите номер телефона" });
    }

    const digits = phone.replace(/\D/g, "");

    if (digits.length < 7 || digits.length > 15) {
      return respond(400, { error: "Некорректная длина номера" });
    }

    const query = `"${phone}"`;
    const searchUrl = new URL("https://searx.be/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("language", "ru-RU");

    const response = await fetch(searchUrl, {
      headers: { "User-Agent": "SherlockAI/1.0" },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      return respond(502, {
        error: "Публичный поисковый сервер недоступен",
        providerStatus: response.status
      });
    }

    const data = await response.json();
    const results = (data.results || []).slice(0, 10).map((item) => ({
      title: item.title || "",
      url: item.url || "",
      snippet: item.content || ""
    }));

    return respond(200, {
      phone,
      count: results.length,
      results,
      message: results.length
        ? "Найдены публичные упоминания"
        : "Публичные упоминания не найдены"
    });
  } catch (error) {
    return respond(502, {
      error: "Ошибка публичного поиска",
      details: error.name === "TimeoutError"
        ? "Истекло время ожидания"
        : "Поисковый сервер не ответил"
    });
  }
};
