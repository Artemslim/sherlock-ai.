const cfg={
phone:{title:"Проверка телефона",label:"Номер телефона",placeholder:"+7 999 123-45-67",hint:"Введи номер — проверим формат и подготовим запросы к публичным поисковикам."},
vehicle:{title:"Проверка автомобиля",label:"VIN (17 символов)",placeholder:"1HGCM82633A004352",hint:"Для VIN выполняется реальный запрос к открытому декодеру NHTSA. Сервис ориентирован прежде всего на автомобили рынка США."},
social:{title:"Публичный профиль",label:"Никнейм или ссылка",placeholder:"username или ссылка",hint:"Работаем с публичными страницами. Совпадение ника не доказывает, что это один человек."},
company:{title:"Проверка компании",label:"ИНН или ОГРН",placeholder:"ИНН / ОГРН",hint:"Открой поиск по официальным открытым реестрам."},
domain:{title:"Домен / IP",label:"Домен или IP-адрес",placeholder:"example.com или 1.1.1.1",hint:"IP-геолокация приблизительна и не доказывает адрес конкретного человека."},
geo:{title:"Поиск места по фото",label:"Фотография",placeholder:"Выбери фото",hint:"Визуальная геолокация требует подключения сервера и источников поиска изображений."}};
let mode="phone";const $=id=>document.getElementById(id);
document.querySelectorAll(".category").forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll(".category").forEach(x=>x.classList.toggle("selected",x===b));$("formTitle").textContent=cfg[mode].title;$("queryLabel").textContent=cfg[mode].label;$("query").placeholder=cfg[mode].placeholder;$("hint").textContent=cfg[mode].hint;$("uploadArea").hidden=mode!=="geo";$("query").hidden=mode==="geo";$("queryLabel").hidden=mode==="geo";});
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function hist(){try{return JSON.parse(localStorage.getItem("sherlock-history")||"[]")}catch{return[]}}
function renderHist(){let a=hist();$("historyList").innerHTML=a.length?a.map((v,i)=>`<div class="historyitem"><div><b>${esc(v.title)}</b><small>${esc(v.query)} · ${esc(v.date)}</small></div><button class="clear" data-del="${i}">Удалить</button></div>`).join(""):'<p class="empty">Пока нет сохранённых запросов.</p>';document.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{let a=hist();a.splice(+b.dataset.del,1);localStorage.setItem("sherlock-history",JSON.stringify(a));renderHist()})}
function addHistory(title,q){let a=hist();a.unshift({title,query:q||"Фотография",date:new Date().toLocaleString("ru-RU")});localStorage.setItem("sherlock-history",JSON.stringify(a.slice(0,20)));renderHist()}
function phoneInfo(raw){
 const digits=raw.replace(/\D/g,"");
 let country="Не определена", callingCode="", validLength=digits.length>=7&&digits.length<=15;
 const rules=[
  ["1","США / Канада"],["7","Россия / Казахстан"],["20","Египет"],["27","ЮАР"],["30","Греция"],["31","Нидерланды"],["32","Бельгия"],["33","Франция"],["34","Испания"],["36","Венгрия"],["39","Италия"],["40","Румыния"],["41","Швейцария"],["43","Австрия"],["44","Великобритания"],["45","Дания"],["46","Швеция"],["47","Норвегия"],["48","Польша"],["49","Германия"],["52","Мексика"],["54","Аргентина"],["55","Бразилия"],["61","Австралия"],["64","Новая Зеландия"],["81","Япония"],["82","Южная Корея"],["86","Китай"],["90","Турция"],["91","Индия"],["971","ОАЭ"],["972","Израиль"],["380","Украина"],["420","Чехия"],["351","Португалия"],["353","Ирландия"],["358","Финляндия"],["370","Литва"],["371","Латвия"],["372","Эстония"],["373","Молдова"],["374","Армения"],["375","Беларусь"],["376","Андорра"],["377","Монако"],["381","Сербия"],["385","Хорватия"],["386","Словения"],["421","Словакия"],["852","Гонконг"],["886","Тайвань"],["880","Бангладеш"],["966","Саудовская Аравия"],["234","Нигерия"],["254","Кения"],["256","Уганда"],["972","Израиль"]
 ];
 let matches=rules.filter(([code])=>digits.startsWith(code)).sort((a,b)=>b[0].length-a[0].length);
 if(matches.length){callingCode="+"+matches[0][0];country=matches[0][1]}
 let norm=raw.trim().startsWith("+")?"+"+digits:digits;
 return {digits,country,callingCode,validLength,norm,startsPlus:raw.trim().startsWith("+")};
}
async function decodeVIN(vin){
 const endpoint="https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/"+encodeURIComponent(vin)+"?format=json";
 const response=await fetch(endpoint,{method:"GET",headers:{"Accept":"application/json"}});
 if(!response.ok)throw new Error("NHTSA ответил HTTP "+response.status);
 const json=await response.json();const row=json.Results&&json.Results[0];
 if(!row)throw new Error("Декодер не вернул запись для этого VIN.");
 const fields=[["Марка",row.Make],["Модель",row.Model],["Год выпуска",row.ModelYear],["Тип кузова",row.BodyClass],["Тип двигателя",row.EngineModel||row.EngineConfiguration],["Количество цилиндров",row.EngineCylinders],["Страна завода",row.PlantCountry],["Завод",row.PlantCompanyName],["Тип коробки передач",row.TransmissionStyle]]
 .filter(([k,v])=>v&&String(v).trim()&&v!=="Not Applicable");
 return fields;
}

async function lookupPublicInstantAnswer(q){
 const response=await fetch("/.netlify/functions/phone-search?q="+encodeURIComponent(q),{
   method:"GET",
   headers:{"Accept":"application/json"},
   cache:"no-store"
 });
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload.error||("HTTP "+response.status));
 return payload;
}
function collectDDG(data){
 return Array.isArray(data.results)?data.results:[];
}

function block(title,body){return `<div class="resultblock"><b>${title}</b>${body}</div>`}
async function runSearch(){
 const q=$("query").value.trim();if(mode!=="geo"&&!q){$("query").focus();return}
 const title=cfg[mode].title;let html="";
 $("resultTitle").textContent=title;$("results").hidden=false;
 if(mode==="vehicle"){
  const isVin=/^[A-HJ-NPR-Z0-9]{17}$/i.test(q);
  if(!isVin){html=block("Проверь VIN",`<p>Стандартный VIN обычно содержит 17 символов и не использует I, O и Q. Госномер здесь автоматически не проверяется.</p>`);$("resultBody").innerHTML=html;addHistory(title,q);return;}
  $("resultBody").innerHTML=block("Статус запроса",`<p id="vinStatus">⏳ Отправляем запрос к NHTSA…</p>`);
  $("searchBtn").disabled=true;$("searchBtn").innerHTML='Запрос выполняется…';
  try{
   const fields=await decodeVIN(q);
   html=block("Статус",`<p><span class="pill">Ответ получен</span> Данные получены из открытого декодера NHTSA.</p>`);
   html+=block("Технические характеристики",fields.length?fields.map(([k,v])=>`<p><b>${esc(k)}:</b> ${esc(v)}</p>`).join(""):`<p>Ответ получен, но основные поля пустые. Возможно, этот VIN не поддерживается базой.</p>`);
   html+=block("Источник",`<p><a target="_blank" rel="noopener" href="https://vpic.nhtsa.dot.gov/decoder/">Официальный декодер NHTSA ↗</a></p><p>Декодирование не является полной историей автомобиля и не подтверждает собственника.</p>`);
  }catch(e){
   html=block("Не удалось получить данные",`<p>${esc(e.message||"Неизвестная ошибка")}</p><p>Причина может быть в соединении, ограничениях браузера или временной недоступности API.</p><p><a target="_blank" rel="noopener" href="https://vpic.nhtsa.dot.gov/decoder/">Проверить VIN вручную на сайте NHTSA ↗</a></p><p>Если ручная страница работает, а запрос здесь нет, понадобится серверный прокси.</p>`);
  }finally{$("searchBtn").disabled=false;$("searchBtn").innerHTML='Проверить запрос <span>→</span>';}
 }else if(mode==="phone"){
  const p=phoneInfo(q);
  const looksInternational=p.startsPlus&&p.validLength;
  html=block("Результат проверки номера",`<p><span class="pill">${looksInternational?"Формат похож на международный":"Проверь формат и длину"}</span> <span class="pill">${esc(p.country)}</span></p><p><b>Нормализованная запись:</b> ${esc(p.norm)}</p><p><b>Международный код:</b> ${esc(p.callingCode||"не определён")}</p><p>Это предварительная проверка формата. Она не показывает владельца, точное местоположение, оператора или активность номера.</p>`);
  const enc=encodeURIComponent('"'+q+'"');
  const digitsEnc=encodeURIComponent('"'+p.digits+'"');
  const noPlus=encodeURIComponent('"'+p.digits.replace(/^7/,"8")+'"');
  const phoneDigits=p.digits;
  const g=(query)=>"https://www.google.com/search?q="+encodeURIComponent(query);
  const y=(query)=>"https://yandex.ru/search/?text="+encodeURIComponent(query);
  html+=block("Поиск публичных упоминаний",`<p>Ниже подготовлены разные варианты запроса. Каждый открывает отдельную страницу поиска.</p>
  <p><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${enc}">Google — номер как введён ↗</a><br>
  <a target="_blank" rel="noopener" href="https://www.google.com/search?q=${digitsEnc}">Google — только цифры ↗</a><br>
  <a target="_blank" rel="noopener" href="https://yandex.ru/search/?text=${enc}">Яндекс — номер как введён ↗</a><br>
  <a target="_blank" rel="noopener" href="https://duckduckgo.com/?q=${enc}">DuckDuckGo ↗</a></p>`);
  html+=block("Поиск объявлений и организаций",`<p><a target="_blank" rel="noopener" href="${g('"'+q+'" (объявление OR телефон OR контакты)')}">Google — объявления и контакты ↗</a><br>
  <a target="_blank" rel="noopener" href="${y('"'+q+'" (объявление OR телефон OR контакты)')}">Яндекс — объявления и контакты ↗</a><br>
  <a target="_blank" rel="noopener" href="${g('"'+phoneDigits+'" (ООО OR ИП OR магазин OR компания OR услуги)')}">Google — компании и услуги ↗</a><br>
  <a target="_blank" rel="noopener" href="${y('"'+phoneDigits+'" (ООО OR ИП OR магазин OR компания OR услуги)')}">Яндекс — компании и услуги ↗</a></p>
  <p>Приложение отправит запрос через защищённую серверную функцию Netlify к поисковому API. Для работы нужен ключ BRAVE_SEARCH_API_KEY в настройках сайта.</p>
  <div id="publicLookupStatus" class="hint">⏳ Запрашиваем доступные публичные ответы…</div><div id="publicLookupResults"></div>`);
  html+=block("Как проверить совпадение",`<ul><li>Сверь, совпадает ли номер полностью.</li><li>Проверь название организации, дату публикации и контекст.</li><li>Ищи подтверждение на официальном сайте или в самом объявлении.</li></ul><p>Поиск не устанавливает владельца частного номера, не показывает точное местоположение и не подтверждает активность SIM-карты.</p>`);
 }else if(mode==="company"){html=block("Официальные источники",`<p><a target="_blank" rel="noopener" href="https://egrul.nalog.ru/">ФНС — ЕГРЮЛ/ЕГРИП ↗</a></p><p>Вставь ИНН/ОГРН в форму реестра. Автоматический разбор ответа пока не подключён.</p>`);}
 else if(mode==="social"){html=block("Публичный поиск",`<p><a target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent(q)}">Google ↗</a><br><a target="_blank" rel="noopener" href="https://yandex.ru/search/?text=${encodeURIComponent(q)}">Яндекс ↗</a></p><p>Совпадение никнейма само по себе не доказывает, что профили принадлежат одному человеку.</p>`);}
 else if(mode==="domain"){html=block("Технические инструменты",`<p><a target="_blank" rel="noopener" href="https://lookup.icann.org/en/lookup?name=${encodeURIComponent(q)}">ICANN Lookup ↗</a><br><a target="_blank" rel="noopener" href="https://dns.google/query?name=${encodeURIComponent(q)}">Google DNS ↗</a><br><a target="_blank" rel="noopener" href="https://ipinfo.io/${encodeURIComponent(q)}">IPinfo ↗</a></p>`);}
 else {html=block("Поиск по изображению",`<p><a target="_blank" rel="noopener" href="https://lens.google.com/">Google Lens ↗</a><br><a target="_blank" rel="noopener" href="https://tineye.com/">TinEye ↗</a></p><p>Автоматическая геолокация по визуальным признакам ещё не подключена.</p>`);}
 html+=block("Ограничение",`<p>Приложение использует открытые инструменты. Оно не подключено к закрытым базам и не подтверждает личность частного человека.</p>`);
 $("resultBody").innerHTML=html;addHistory(title,q);
 if(mode==="phone"){
   const status=$("publicLookupStatus"), target=$("publicLookupResults");
   if(status&&target){
     try{
       const data=await lookupPublicInstantAnswer(q);
       const items=collectDDG(data);
       if(items.length){
         status.textContent="Найдено публичных страниц: "+items.length+". Проверь контекст и первоисточник.";
         target.innerHTML=items.map(it=>`<div class="resultblock"><b>${esc(it.title||"Результат поиска")}</b><p>${esc(it.description||"Описание отсутствует.")}</p><p><a target="_blank" rel="noopener" href="${esc(it.url)}">Открыть страницу ↗</a></p>${it.age?`<small>${esc(it.age)}</small>`:""}</div>`).join("");
       }else{
         status.textContent="Поиск завершился, но совпадений не найдено. Попробуй номер с кодом страны или без пробелов.";
       }
     }catch(err){
       status.textContent=err.message||"Автоматический поиск недоступен. Проверь настройки API-ключа Netlify; поисковые ссылки выше продолжают работать.";
     }
   }
 }
}
$("searchBtn").addEventListener("click",runSearch);$("closeResult").onclick=()=>$("results").hidden=true;$("clearHistory").onclick=()=>{localStorage.removeItem("sherlock-history");renderHist()};renderHist();
