
const cfg = {
  phone: {
    title: "Проверка телефона",
    label: "Номер телефона",
    placeholder: "+7 999 123-45-67",
    hint: "Проверка формата и поиск публичных упоминаний."
  },
  vehicle: {
    title: "Проверка автомобиля",
    label: "VIN (17 символов)",
    placeholder: "1HGCM82633A004352",
    hint: "Декодирование VIN через открытый сервис NHTSA."
  },
  social: {
    title: "Публичный профиль",
    label: "Никнейм или ссылка",
    placeholder: "username или ссылка",
    hint: "Поиск публичных страниц по нику или ссылке."
  },
  company: {
    title: "Проверка компании",
    label: "ИНН, ОГРН или название",
    placeholder: "ИНН / ОГРН / название",
    hint: "Поиск публичных сведений об организации."
  },
  domain: {
    title: "Домен / IP",
    label: "Домен или IP-адрес",
    placeholder: "example.com или 1.1.1.1",
    hint: "Поиск публичных технических сведений."
  },
  geo: {
    title: "Поиск места по фото",
    label: "Фотография",
    placeholder: "Выбери фото",
    hint: "Автоматическая геолокация по фото пока не подключена."
  }
};

let mode = "phone";
const $ = id => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));
}

function block(title, body) {
  return `<div class="resultblock"><b>${esc(title)}</b>${body}</div>`;
}

function hist() {
  try {
    return JSON.parse(localStorage.getItem("sherlock-history") || "[]");
  } catch {
    return [];
  }
}

function renderHist() {
  const a = hist();
  $("historyList").innerHTML = a.length
    ? a.map((v, i) => `
      <div class="historyitem">
        <div>
          <b>${esc(v.title)}</b>
          <small>${esc(v.query)} · ${esc(v.date)}</small>
        </div>
        <button class="clear" data-del="${i}">Удалить</button>
      </div>
    `).join("")
    : '<p class="empty">Пока нет сохранённых запросов.</p>';

  document.querySelectorAll("[data-del]").forEach(b => {
    b.onclick = () => {
      const items = hist();
      items.splice(Number(b.dataset.del), 1);
      localStorage.setItem("sherlock-history", JSON.stringify(items));
      renderHist();
    };
  });
}

function addHistory(title, query) {
  const items = hist();
  items.unshift({
    title,
    query: query || "Фотография",
    date: new Date().toLocaleString("ru-RU")
  });
  localStorage.setItem(
    "sherlock-history",
    JSON.stringify(items.slice(0, 20))
  );
  renderHist();
}

document.querySelectorAll(".category").forEach(button => {
  button.onclick = () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".category").forEach(item =>
      item.classList.toggle("selected", item === button)
    );

    $("formTitle").textContent = cfg[mode].title;
    $("queryLabel").textContent = cfg[mode].label;
    $("query").placeholder = cfg[mode].placeholder;
    $("hint").textContent = cfg[mode].hint;
    $("uploadArea").hidden = mode !== "geo";
    $("query").hidden = mode === "geo";
    $("queryLabel").hidden = mode === "geo";
  };
});

function phoneInfo(raw) {
  const digits = raw.replace(/\D/g, "");
  const rules = [
    ["1", "США / Канада"], ["7", "Россия / Казахстан"],
    ["20", "Египет"], ["27", "ЮАР"], ["30", "Греция"],
    ["31", "Нидерланды"], ["32", "Бельгия"], ["33", "Франция"],
    ["34", "Испания"], ["39", "Италия"], ["40", "Румыния"],
    ["41", "Швейцария"], ["43", "Австрия"], ["44", "Великобритания"],
    ["45", "Дания"], ["46", "Швеция"], ["47", "Норвегия"],
    ["48", "Польша"], ["49", "Германия"], ["52", "Мексика"],
    ["55", "Бразилия"], ["61", "Австралия"], ["64", "Новая Зеландия"],
    ["81", "Япония"], ["82", "Южная Корея"], ["86", "Китай"],
    ["90", "Турция"], ["91", "Индия"], ["351", "Португалия"],
    ["353", "Ирландия"], ["358", "Финляндия"], ["370", "Литва"],
    ["371", "Латвия"], ["372", "Эстония"], ["375", "Беларусь"],
    ["380", "Украина"], ["420", "Чехия"], ["421", "Словакия"],
    ["852", "Гонконг"], ["886", "Тайвань"], ["966", "Саудовская Аравия"],
    ["971", "ОАЭ"], ["972", "Израиль"]
  ];

  const match = rules
    .filter(([code]) => digits.startsWith(code))
    .sort((a, b) => b[0].length - a[0].length)[0];

  const startsPlus = raw.trim().startsWith("+");

  return {
    digits,
    country: match ? match[1] : "Не определена",
    callingCode: match ? "+" + match[0] : "Не определён",
    validLength: digits.length >= 7 && digits.length <= 15,
    norm: startsPlus ? "+" + digits : digits,
    startsPlus
  };
}

async function decodeVIN(vin) {
  const endpoint =
    "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/" +
    encodeURIComponent(vin) + "?format=json";

  const response = await fetch(endpoint);
  if (!response.ok) throw new Error("NHTSA ответил HTTP " + response.status);

  const json = await response.json();
  const row = json.Results?.[0];
  if (!row) throw new Error("Декодер не вернул данные.");

  return [
    ["Марка", row.Make],
    ["Модель", row.Model],
    ["Год выпуска", row.ModelYear],
    ["Тип кузова", row.BodyClass],
    ["Двигатель", row.EngineModel || row.EngineConfiguration],
    ["Цилиндры", row.EngineCylinders],
    ["Страна завода", row.PlantCountry],
    ["Завод", row.PlantCompanyName],
    ["Коробка передач", row.TransmissionStyle]
  ].filter(([key, value]) =>
    value && String(value).trim() && value !== "Not Applicable"
  );
}

/*
 * Запрос к Netlify Function.
 * Функция должна быть развёрнута по адресу:
 * /.netlify/functions/phone-search
 */
async function publicSearch(query) {
  const endpoint = "/.netlify/functions/phone-search?q=" +
    encodeURIComponent(query);

  const response = await fetch(endpoint, {
    method: "GET",
    headers: { "Accept": "application/json" }
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул ответ не в формате JSON.");
  }

  if (!response.ok) {
    throw new Error(data.error || "Ошибка поиска: HTTP " + response.status);
  }

  if (!Array.isArray(data.results)) {
    throw new Error("Сервер не вернул список результатов.");
  }

  return data.results.slice(0, 10);
}

function renderSearchResults(results) {
  if (!results.length) {
    return block("Результаты поиска",
      "<p>Публичные страницы не найдены. Попробуй изменить запрос или открыть обычный поисковик.</p>"
    );
  }

  return block("Найденные публичные страницы",
    results.map(item => {
      const safeUrl = (() => {
        try {
          const url = new URL(item.url);
          return ["https:", "http:"].includes(url.protocol)
            ? url.href : "";
        } catch {
          return "";
        }
      })();

      if (!safeUrl) return "";

      return `<div class="search-result">
        <p><a target="_blank" rel="noopener noreferrer" href="${esc(safeUrl)}">${esc(item.title || safeUrl)} ↗</a></p>
        <p>${esc(item.snippet || "Описание отсутствует.")}</p>
        <small>${esc(new URL(safeUrl).hostname)}</small>
      </div>`;
    }).join("")
  );
}

function searchLinks(query) {
  const encoded = encodeURIComponent(query);
  return `<p>
    <a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encoded}">Google ↗</a><br>
    <a target="_blank" rel="noopener noreferrer" href="https://yandex.ru/search/?text=${encoded}">Яндекс ↗</a><br>
    <a target="_blank" rel="noopener noreferrer" href="https://duckduckgo.com/?q=${encoded}">DuckDuckGo ↗</a>
  </p>`;
}

async function runSearch() {
  const q = $("query").value.trim();

  if (mode !== "geo" && !q) {
    $("query").focus();
    return;
  }

  const title = cfg[mode].title;
  let html = "";

  $("resultTitle").textContent = title;
  $("results").hidden = false;
  $("resultBody").innerHTML = block("Статус", "<p>Подготовка запроса…</p>");
  $("searchBtn").disabled = true;
  $("searchBtn").textContent = "Поиск выполняется…";

  try {
    if (mode === "phone") {
      const p = phoneInfo(q);
      html += block("Проверка номера",
        `<p><span class="pill">${p.startsPlus && p.validLength ? "Похож на международный формат" : "Проверь формат и длину"}</span></p>
        <p><b>Нормализованная запись:</b> ${esc(p.norm)}</p>
        <p><b>Код страны:</b> ${esc(p.callingCode)}</p>
        <p><b>Предполагаемая страна:</b> ${esc(p.country)}</p>
        <p>Это проверка формата, а не установление владельца номера.</p>`
      );

      html += block("Поиск в интернете", "<p>Ищем публичные страницы…</p>");
      $("resultBody").innerHTML = html;

      const results = await publicSearch('"' + q + '"');
      html = html.replace(
        block("Поиск в интернете", "<p>Ищем публичные страницы…</p>"),
        renderSearchResults(results)
      );

      html += block("Дополнительный поиск", searchLinks('"' + q + '"'));
      html += block("Важно",
        "<p>Совпадение номера в публикации не доказывает, кто сейчас им пользуется. Не публикуй личные данные без согласия владельца.</p>"
      );

    } else if (mode === "vehicle") {
      if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(q)) {
        html = block("Проверь VIN",
          "<p>VIN обычно содержит 17 символов. Буквы I, O и Q не используются.</p>"
        );
        html += block("Ручная проверка",
          '<p><a target="_blank" rel="noopener noreferrer" href="https://vpic.nhtsa.dot.gov/decoder/">Открыть декодер NHTSA ↗</a></p>'
        );
      } else {
        const fields = await decodeVIN(q);
        html = block("Технические характеристики",
          fields.length
            ? fields.map(([key, value]) =>
                `<p><b>${esc(key)}:</b> ${esc(value)}</p>`
              ).join("")
            : "<p>Ответ получен, но основные поля пустые.</p>"
        );
        html += block("Источник",
          '<p><a target="_blank" rel="noopener noreferrer" href="https://vpic.nhtsa.dot.gov/decoder/">Официальный декодер NHTSA ↗</a></p><p>Декодирование не подтверждает собственника или историю автомобиля.</p>'
        );
      }

    } else if (mode === "social" || mode === "company" || mode === "domain") {
      html = block("Автоматический поиск", "<p>Ищем публичные страницы…</p>");
      $("resultBody").innerHTML = html;

      const results = await publicSearch(q);
      html = renderSearchResults(results);
      html += block("Поиск в других источниках", searchLinks(q));

      if (mode === "company") {
        html += block("Официальный реестр",
          '<p><a target="_blank" rel="noopener noreferrer" href="https://egrul.nalog.ru/">ФНС — ЕГРЮЛ/ЕГРИП ↗</a></p>'
        );
      }

      if (mode === "domain") {
        html += block("Технические источники",
          `<p><a target="_blank" rel="noopener noreferrer" href="https://lookup.icann.org/en/lookup?name=${encodeURIComponent(q)}">ICANN Lookup ↗</a><br>
          <a target="_blank" rel="noopener noreferrer" href="https://dns.google/query?name=${encodeURIComponent(q)}">Google DNS ↗</a><br>
          <a target="_blank" rel="noopener noreferrer" href="https://ipinfo.io/${encodeURIComponent(q)}">IPinfo ↗</a></p>
          <p>Геолокация IP приблизительна и не устанавливает адрес конкретного человека.</p>`
        );
      }

      if (mode === "social") {
        html += block("Ограничение",
          "<p>Совпадение никнейма не доказывает, что профили принадлежат одному человеку.</p>"
        );
      }

    } else {
      html = block("Поиск по изображению",
        '<p><a target="_blank" rel="noopener noreferrer" href="https://lens.google.com/">Google Lens ↗</a><br><a target="_blank" rel="noopener noreferrer" href="https://tineye.com/">TinEye ↗</a></p><p>Автоматическая геолокация по фото пока не подключена.</p>'
      );
    }
  } catch (error) {
    html += block("Автоматический поиск недоступен",
      `<p>${esc(error.message || "Неизвестная ошибка")}</p>
      <p>Можно попробовать обычные поисковики:</p>${searchLinks(q)}`
    );

    if (mode === "phone") {
      const p = phoneInfo(q);
      html = block("Проверка номера",
        `<p><b>Нормализованная запись:</b> ${esc(p.norm)}</p>
        <p><b>Предполагаемая страна:</b> ${esc(p.country)}</p>`
      ) + html;
    }
  } finally {
    $("resultBody").innerHTML = html;
    addHistory(title, q);
    $("searchBtn").disabled = false;
    $("searchBtn").innerHTML = 'Проверить запрос <span>→</span>';
  }
}

$("searchBtn").addEventListener("click", runSearch);

$("closeResult").onclick = () => {
  $("results").hidden = true;
};

$("clearHistory").onclick = () => {
  localStorage.removeItem("sherlock-history");
  renderHist();
};

renderHist();
