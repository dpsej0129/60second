import "./style.css";
import {
  Game,
  ITEMS,
  FAMILY,
  HOME,
  SHELVES,
  COLS,
  ROWS,
  CAPACITY,
  blocked,
  MAX_QUIET_DAYS,
} from "./engine.js";

const app = document.querySelector("#app");
let game = new Game();
let rations = {};
let helpOpen = false;
let journalOpen = false;
let selectedLoot = 0;
const keys = new Set();
const paths = {
  arrow: "M4 12h16m-6-6 6 6-6 6",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  home: "m3 10 9-7 9 7M5 9v11h14V9M10 20v-7h4v7",
  bag: "M6 7h12l2 14H4L6 7ZM9 7V5a3 3 0 0 1 6 0v2",
  can: "M6 5c0-3 12-3 12 0v14c0 3-12 3-12 0V5Zm0 0c0 3 12 3 12 0M6 10h12M6 17h12",
  water: "M9 3h6v4l3 4v9H6v-9l3-4V3ZM9 7h6M6 13h12",
  med: "M9 6V3h6v3M3 7h18v14H3V7Zm9 4v6m-3-3h6",
  radio: "M5 9h15v12H4V9h1Zm2 0L16 2M7 13h5m-5 3h5m4-3h1m-1 4h1",
  tools: "m14 6 4 4M3 21l9-9m1-8a6 6 0 0 0-1 8 6 6 0 0 0 8-1l-4 1-3-3 1-5Z",
  box: "m3 7 9-4 9 4v12l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v12M7 5l9 4",
  users:
    "M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 6",
  heart: "M20 5c-3-3-7-1-8 1-1-2-5-4-8-1s-1 6 1 8l7 7 7-7c2-2 4-5 1-8Z",
  note: "M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4",
  skull: "M7 16c-7-5-3-14 5-14s12 9 5 14v5H7v-5ZM8 10h1m6 0h1m-6 7v4m4-4v4",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-6v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  help: "M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  volume: "m3 9 4 0 5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10",
  flag: "M5 22V3h14l-3 5 3 5H5",
  leaf: "M4 20C0 6 12 3 21 3c0 10-2 19-14 16M5 19 16 8",
};
function icon(name, cls = "") {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.box}"/></svg>`;
}
const button = (text, action, cls = "primary", attrs = "") =>
  `<button class="button ${cls}" data-action="${action}" ${attrs}>${text}</button>`;
const alive = () => game.living().length;
function clock() {
  return `${String(Math.floor(Math.max(0, game.remaining || 0))).padStart(2, "0")}<span>.${Math.floor((Math.max(0, game.remaining || 0) % 1) * 10)}</span>`;
}
function header() {
  return `<header class="topbar"><a class="brand" href="#" aria-label="60 Second Home"><b>60<span>″</span></b><div>SECOND : HOME<small>A ZOMBIE SURVIVAL STORY</small></div></a>${game.phase === "expedition" ? `<div class="header-timer">${icon("clock")}<span>귀가까지</span><strong id="header-clock">${clock()}</strong></div>` : '<div class="session-label"><span class="live-dot"></span> 살아남는 것, 그 이상의 이야기</div>'}<button class="icon-button" data-action="help" aria-label="플레이 방법">${icon("help")}</button></header>`;
}
function sidebar() {
  const expedition = game.phase === "expedition" || game.phase === "intro";
  return `<aside class="rail"><div class="chapter">CHAPTER 01</div><div class="rail-title">돌아갈 곳이<br>있다는 것.</div><nav aria-label="게임 화면"><div class="nav-item ${expedition ? "active" : ""}">${icon("bag")}<span>마트 & 보급</span>${expedition ? "<i></i>" : ""}</div><div class="nav-item ${!expedition ? "active" : ""}">${icon("home")}<span>우리의 집</span>${!expedition ? "<i></i>" : ""}</div><button class="nav-item" data-action="journal">${icon("note")}<span>생존 기록</span><em>${game.journal.length}</em></button></nav><div class="rail-note"><span>KEEP THIS IN MIND</span><p>챙길 수 있는 건<br>네 칸뿐.<br>지켜야 할 것은<br>그보다 많다.</p><div class="little-line"></div><small>선택은 남고,<br>시간은 흐른다.</small></div><div class="rail-footer">EST. BEFORE THE END<br><b>35° 10′ N · 129° 04′ E</b></div></aside>`;
}
function titlebar(eyebrow, title, desc, side = "") {
  return `<div class="titlebar"><div><div class="eyebrow"><span class="tiny-line"></span>${eyebrow}</div><h1>${title}</h1><p>${desc}</p></div>${side}</div>`;
}
function houseArt() {
  return `<svg class="house-art" viewBox="0 0 720 290" fill="none" aria-label="불이 켜진 우리 집과 어두운 거리" role="img"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#252e29"/><stop offset="1" stop-color="#171f1a"/></linearGradient><pattern id="lines" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M0 16 16 0" stroke="#ffffff" stroke-opacity=".025"/></pattern><radialGradient id="glow"><stop stop-color="#e7b879" stop-opacity=".18"/><stop offset="1" stop-color="#e7b879" stop-opacity="0"/></radialGradient></defs><path fill="url(#sky)" d="M0 0h720v290H0z"/><path fill="url(#lines)" d="M0 0h720v290H0z"/><circle cx="568" cy="58" r="18" fill="#bec8ad" opacity=".7"/><circle cx="578" cy="51" r="19" fill="#252e29"/><path d="M0 213h720M0 266h720" stroke="#58614f" stroke-opacity=".25"/><path d="M0 201h80v-88l25-16 42 30v74h66m335 0h45v-80l33-26 46 28v78h48" fill="#121a15" stroke="#3c4639"/><path d="M36 130v-66m-20 19h40m-18-5c130 35 220 4 345 4S622 125 720 73" stroke="#59604d" opacity=".5"/><path d="m219 136 132-93 139 93" fill="#161e18" stroke="#76816a" stroke-width="2"/><path d="M239 135h230v115H239z" fill="#293027" stroke="#717660"/><path d="m205 143 146-101 152 101h-26L351 61 230 143h-25Z" fill="#373e30" stroke="#81846a"/><path d="M402 78V42h24v54" fill="#383e32" stroke="#747b63"/><path d="M340 250v-73h42v73" fill="#171e19" stroke="#8d8c6c"/><path d="M347 188h28v44h-28z" fill="#ac8b55" opacity=".45"/><circle cx="374" cy="224" r="2" fill="#dec799"/><path d="M263 168h46v48h-46zM404 168h42v48h-42z" fill="#dbb67a" opacity=".68"/><path d="M260 165h52v54h-52zM401 165h48v54h-48zM286 165v54m-26-27h52m113-27v54m-24-27h48" stroke="#111b14" stroke-width="4"/><path d="m255 169 59 42m-62-28 60 42" stroke="#6a6450" stroke-width="7"/><ellipse cx="360" cy="212" rx="145" ry="105" fill="url(#glow)"/><path d="M326 251h70v7h-70zM320 259h82v7h-82z" fill="#62674e"/><path d="M175 247v-48m-32 48v-48m64 48v-48m-80 13h93m-93 20h93M506 247v-48m33 48v-48m33 48v-48m-80 13h94m-94 20h94" stroke="#62684f" stroke-width="4"/><path d="M73 252c8-12 4-23 12-30m-3 26 13-14M628 256c-3-18 4-34 7-43m-4 28-14-10" stroke="#657557" stroke-width="2"/><path d="M0 278c145-4 232 4 363 0s237-6 357-2" stroke="#616b52" stroke-dasharray="10 14" opacity=".35"/><text x="22" y="31" fill="#8c997f" font-size="9" font-family="monospace" letter-spacing="2">SAFE HOUSE / SECTOR 04</text><circle cx="684" cy="28" r="3" fill="#a6b18b"/></svg>`;
}
function intro() {
  return `${titlebar("PROLOGUE / THE FIRST RUN", "아직, 돌아갈 집이 있다.", "문이 닫히기 전, 당신은 무엇을 챙기겠습니까?", `<div class="day-stamp">${icon("sun")}<span>DAY <b>01</b></span></div>`)}<section class="intro-hero"><div class="intro-copy"><div class="tag outlined">60 SECONDS. FOUR SLOTS. ONE HOME.</div><h2>살아남을 물자.<br>함께할 사람.<br><em>당신의 60초.</em></h2><p>마트의 불이 꺼지고, 누군가 달려옵니다.<br>물자를 챙겨 집으로 돌아가세요.<br>그다음은, 당신이 내린 선택의 몫입니다.</p>${button(`첫 보급 시작하기 ${icon("arrow")}`, "start")}<small>버튼을 누르면 60초 카운트다운이 시작됩니다.</small></div><div class="intro-art">${houseArt()}<div class="big-sixty">60<span>SECONDS<br>TO GET HOME</span></div><div class="art-caption"><span class="live-dot"></span> 목적지: 집 · 거리: 24블록</div></div></section><div class="intro-rules"><article><span>01 / SCAVENGE</span>${icon("bag")}<h3>챙기고, 달리고.</h3><p>가방은 네 칸. 이동과 수집, 귀가까지<br>모두 같은 60초 안에.</p></article><article><span>02 / CHOOSE</span>${icon("users")}<h3>누구와 함께할까.</h3><p>세 명의 가족, 세 번의 선택.<br>늘어나는 식구는 부담이자 힘입니다.</p></article><article><span>03 / SURVIVE</span>${icon("radio")}<h3>그다음 날을 위해.</h3><p>배급하고, 보급하고, 신호에 응답하세요.<br>결말은 날짜가 아닌 행동으로 열립니다.</p></article></div>`;
}
function mapMarkup() {
  const tile = 32;
  const floor = Array.from({ length: COLS * ROWS }, (_, i) => {
    const x = i % COLS,
      y = Math.floor(i / COLS);
    return `<rect x="${x * tile}" y="${y * tile}" width="32" height="32" fill="${x < 18 ? ((x + y) % 2 ? "#272e26" : "#293128") : x < 26 ? "#252b25" : "#33392c"}" stroke="#404a3b" stroke-opacity=".16"/>`;
  }).join("");
  const shelves = SHELVES.map(
    (r) =>
      `<g><rect x="${r.x * tile - 2}" y="${r.y * tile + 3}" width="${r.w * tile + 4}" height="${r.h * tile}" rx="3" fill="#151c16"/><rect x="${r.x * tile}" y="${r.y * tile}" width="${r.w * tile}" height="${r.h * tile}" rx="2" fill="#4a4d39" stroke="#79775a" stroke-width="1"/>${[0, 1, 2].map((i) => `<path d="M${r.x * tile + 6} ${r.y * tile + 16 + i * 30}h${r.w * tile - 12}" stroke="#a49b70" stroke-opacity=".4" stroke-width="9" stroke-dasharray="10 5 14 4"/>`).join("")}<rect x="${r.x * tile + 10}" y="${r.y * tile + 38}" width="${r.w * tile - 20}" height="20" rx="2" fill="#272f25"/><text x="${(r.x + r.w / 2) * tile}" y="${r.y * tile + 51}" text-anchor="middle" fill="#c3c5a5" font-family="monospace" font-size="8" letter-spacing="1">${r.label}</text></g>`,
  ).join("");
  const walls = `<path d="M16 16H576v208m0 64v208H16V16" stroke="#87917b" stroke-width="6" fill="none"/><path d="M832 256v-80h96m-96 112v80h96" fill="none" stroke="#9a9b7b" stroke-width="6"/><path d="M575 226h18m-18 60h18" stroke="#cfba83" stroke-width="4"/><rect x="736" y="64" width="32" height="128" rx="7" fill="#515447" stroke="#727765"/><rect x="739" y="84" width="26" height="32" fill="#252d28"/><rect x="739" y="148" width="26" height="24" fill="#252d28"/><rect x="672" y="352" width="32" height="96" rx="7" fill="#664a3c" stroke="#82664e"/><path d="M786 32v100m0 30v64m0 96v64m0 32v60" stroke="#aaa77c" stroke-opacity=".25" stroke-dasharray="16 16" stroke-width="3"/>`;
  const items = game.loot
    .map((l) => {
      const item = ITEMS[l.type];
      return `<g class="loot-node ${l.count ? "" : "empty"} ${selectedLoot === l.id ? "selected" : ""}" data-loot="${l.id}" data-count="${l.count}" transform="translate(${l.x * tile + 16},${l.y * tile + 16})" tabindex="0" role="button" aria-label="${item.name} ${item.slots}칸, ${l.count}개 남음"><title>${item.name} · ${item.slots}칸 · ${item.detail} · 남은 ${l.count}개</title><circle r="17" fill="#18221c" stroke="${l.count ? item.color : "#535d4b"}" stroke-width="1.5"/><svg x="-10" y="-10" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${item.color}" stroke-width="1.5" stroke-linejoin="round"><path d="${paths[item.icon]}"/></svg><circle cx="15" cy="-13" r="8" fill="${item.color}"/><text x="15" y="-10" fill="#162017" text-anchor="middle" font-size="9" font-weight="bold">${item.slots}</text></g>`;
    })
    .join("");
  return `<svg id="world" viewBox="0 0 960 512" role="img" aria-label="마트와 집 지도. 진열대 아이콘을 클릭해 수집하고 집을 클릭해 귀가하세요.">${floor}<path d="M640 260h170" stroke="#97a17b" stroke-opacity=".15" stroke-width="40"/>${shelves}${walls}<text x="32" y="45" fill="#a4ae91" font-size="12" letter-spacing="4" font-family="monospace">MART 04</text><text x="613" y="45" fill="#8b967e" font-size="9" letter-spacing="2" font-family="monospace">DEAD END AVE.</text><text x="38" y="484" fill="#8e977e" font-size="9" font-family="monospace" letter-spacing="2">LIMITED STOCK · NO RESTOCK</text><g class="home-target" data-action="home" tabindex="0" role="button" aria-label="집으로 이동"><title>집으로 돌아가기 · 도착하면 물품 자동 하역</title><rect x="848" y="220" width="72" height="100" rx="3" fill="#b5b68b" fill-opacity=".12" stroke="#c4c491" stroke-dasharray="4 4"/><path d="m868 248 16-13 16 13m-28-2v22h24v-22m-15 22v-13h7v13" stroke="#d3d1a0" stroke-width="2" fill="none"/><text x="884" y="295" fill="#d3d1a0" text-anchor="middle" font-size="10" letter-spacing="2">HOME</text></g>${items}<path id="walk-path" fill="none" stroke="#d5c091" stroke-width="2" stroke-opacity=".45" stroke-dasharray="4 5"/><g id="zombie"><circle r="16" fill="#d5876f" opacity=".10"/><circle r="7" fill="#a77261" stroke="#d68c73" stroke-width="2"/><path d="m-11 7 8-3m6 0 8 3" stroke="#c3846b" stroke-width="3"/></g><g id="player"><circle r="18" fill="#d6c89c" opacity=".1"/><circle r="8" fill="#dfc894" stroke="#fbebc3" stroke-width="2"/><path d="m-4 1 4-4 4 4" stroke="#333b2a" stroke-width="1.5"/><text y="-25" fill="#eee0b9" text-anchor="middle" font-size="9" letter-spacing="1">YOU</text></g></svg>`;
}
function bagMarkup() {
  let cells = [];
  game.bag.forEach((type, index) => {
    const i = ITEMS[type];
    cells.push(
      `<button class="bag-cell filled size-${i.slots}" data-action="drop" data-index="${index}" title="${i.name} · ${i.slots}칸 · 클릭하면 진열대로 돌려놓기">${icon(i.icon)}<span>${i.name}</span><small>${i.slots}칸 · 반환 ×</small></button>`,
    );
  });
  for (let i = game.usedSlots; i < CAPACITY; i++)
    cells.push(
      `<div class="bag-cell"><span class="slot-number">0${i + 1}</span><small>빈 공간</small></div>`,
    );
  return `<section class="bag-panel"><div class="panel-heading"><h2>${icon("bag")}내 가방 <span>INVENTORY</span></h2><b>${game.usedSlots} <em>/ 4칸</em></b></div><div class="bag-grid">${cells.join("")}</div><p>큰 물품은 2칸을 차지합니다. 귀가하면 집 재고로 자동 이동합니다.</p></section>`;
}
function expedition() {
  const l = game.loot.find((l) => l.id === selectedLoot),
    item = ITEMS[l.type];
  return `${titlebar(`SUPPLY RUN / ${String(game.trip).padStart(2, "0")}`, game.trip === 1 ? "필요한 것만. 그리고 집으로." : "문을 나섰다면, 다시 60초.", "진열대 클릭 → 이동 및 수집 · 빈 바닥 클릭 → 이동 · 집 클릭 → 귀가", `<div class="timer-box"><div>${icon("clock")}<span>집에 돌아오기까지</span></div><strong id="clock">${clock()}</strong><small>이동 + 수집 + 귀가</small></div>`)}<div class="expedition-grid"><div class="map-column"><section class="map-panel"><div class="map-top"><span><i class="live-dot"></i> LIVE / ${game.trip === 1 ? "마트 내부" : "보급 중"}</span><span>SECTOR 04 <b>↗ N</b></span></div><div class="map-wrap">${mapMarkup()}</div><div class="map-bottom"><span><i class="dot player-dot"></i> 나</span><span><i class="dot zombie-dot"></i> 추격자</span><span><i class="dot home-dot"></i> 안전가옥</span><span class="map-scale">1칸 = 1블록</span></div></section><div class="status-strip" role="status" id="notice">${icon("volume")}<span>${game.notice}</span></div>${bagMarkup()}</div><aside class="supply-side"><section class="panel supplies"><div class="panel-heading"><h2>챙길 수 있는 것</h2><span class="tag">MART STOCK</span></div><p class="muted small">클릭 전에 칸 수와 남은 수량을 확인하세요.</p><div class="supply-list">${game.loot
    .filter((l, i, a) => a.findIndex((s) => s.type === l.type) === i)
    .map((l) => {
      const i = ITEMS[l.type],
        stocked = game.loot.find((s) => s.type === l.type && s.count > 0) || l,
        count = game.loot
          .filter((s) => s.type === l.type)
          .reduce((n, s) => n + s.count, 0);
      return `<button class="supply-row ${game.loot[selectedLoot]?.type === l.type ? "selected" : ""}" data-action="select-loot" data-id="${stocked.id}"><span class="item-icon" style="--item-color:${i.color}">${icon(i.icon)}</span><span><b>${i.name}</b><small>${i.detail} · ${count}개 남음</small></span><em>${i.slots}칸</em></button>`;
    })
    .join(
      "",
    )}</div></section><section class="selected-item"><div class="eyebrow">YOUR NEXT CHOICE</div><h3>${icon(item.icon)}${item.name}<b>${item.slots}칸</b></h3><p>${item.detail} · 이 지점에 ${l.count}개 남음</p>${button(`이 물품 수집하기 ${icon("arrow")}`, "collect", "secondary", `${l.count <= 0 || game.usedSlots + item.slots > 4 ? "disabled" : ""}`)}<small>도착 후 0.8초 동안 수집 · 시간은 계속 흐릅니다.</small></section>${button(`${icon("home")} 집으로 돌아가기`, "home", "primary full")}<div class="control-hint"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>또는 방향키로 이동</span><br><kbd>E</kbd><span>가까운 물품 수집</span></div></aside></div>`;
}
function resources() {
  return `<div class="resources">${[
    ["food", "식량", "can", "인분"],
    ["water", "물", "water", "인분"],
    ["medicine", "구급약", "med", "회"],
    ["tools", "공구", "tools", "개"],
  ]
    .map(
      ([key, name, ico, unit]) =>
        `<article class="resource ${game.stock[key] === 0 ? "low" : ""}"><div>${icon(ico)}<span>${name}</span></div><strong>${game.stock[key]}<small>${unit}</small></strong><p>${key === "food" || key === "water" ? `전원 배급 시 ${Math.floor(game.stock[key] / alive())}일분` : key === "medicine" ? "1회 사용 · 한 명 치료" : "방어 / 공동체 수리"}</p></article>`,
    )
    .join("")}</div>`;
}
function portrait(p, large = false) {
  return `<div class="portrait ${large ? "large" : ""} ${!p.alive ? "dead" : ""}" style="--person:${p.color}"><svg viewBox="0 0 80 90" aria-hidden="true"><path d="M0 0h80v90H0z" fill="currentColor" opacity=".08"/><path d="M10 92c1-23 10-31 30-31s29 8 30 31" fill="currentColor" opacity=".5"/><path d="M32 53h16v16H32z" fill="currentColor"/><ellipse cx="40" cy="38" rx="17" ry="22" fill="currentColor" opacity=".85"/><path d="M22 39c-9-29 16-35 26-29 18 1 17 20 9 31l-3-18-26 3-6 13Z" fill="#242b24"/><path d="M33 40h2m11 0h2m-12 12h9" stroke="#242b24" stroke-width="2"/>${p.id === "jiwoo" ? '<path d="M48 76h10m-5-5v10" stroke="#e7e2cc" stroke-width="2"/>' : p.id === "jun" ? '<path d="m22 80 12-8m17 0 8 9" stroke="#343e30" stroke-width="3"/>' : p.id === "eun" ? '<path d="M22 22c-13 9-7 27-1 29m37-29c13 9 7 27 1 29" stroke="#242b24" stroke-width="7"/>' : ""}</svg></div>`;
}
function peoplePanel() {
  return `<section class="panel people-panel"><div class="panel-heading"><h2>함께 있는 사람들 <span>OUR PEOPLE</span></h2><span class="tag">${alive()}명 생존</span></div><div class="people-list">${game.people.map((p) => `${p.alive ? '<article class="person-row">' : '<article class="person-row deceased">'}${portrait(p)}<div class="person-info"><h3>${p.name}<small>${p.role}</small></h3><div class="health" aria-label="체력 ${p.health}/5">${Array.from({ length: 5 }, (_, i) => `<i class="${i < p.health ? "filled" : ""}"></i>`).join("")}</div><p>${!p.alive ? "사망 · 기억하겠습니다" : [p.injured ? "부상 · 매일 체력 −1" : "", p.thirst ? "갈증 " + p.thirst + "일" : "", p.hunger ? "허기 " + p.hunger + "일" : ""].filter(Boolean).join(" / ") || "안정 · 오늘도 함께"}</p></div>${p.alive ? `<div class="person-rations"><label><input type="checkbox" data-ration="${p.id}" data-resource="food" ${rations[p.id]?.food ? "checked" : ""}>${icon("can")} 식량</label><label><input type="checkbox" data-ration="${p.id}" data-resource="water" ${rations[p.id]?.water ? "checked" : ""}>${icon("water")} 물</label></div><button class="heal-button" data-action="heal" data-id="${p.id}" aria-label="${p.name} 치료" title="구급약 1회 사용${game.has("jiwoo") ? " · 지우 치료 보너스" : ""}" ${game.stock.medicine < 1 || (!p.injured && p.health === 5) ? "disabled" : ""}>${icon("med")} 치료</button>` : ""}</article>`).join("")}</div><div id="ration-summary">${rationSummary()}</div><p class="ration-note">부족하면 위에서부터 배급합니다. 무배급 시 허기 3일째부터 체력 −1, 갈증 2일째부터 −2. 치료는 배급 전에 적용됩니다.</p></section>`;
}
function rationSummary() {
  const food = game.living().filter((p) => rations[p.id]?.food).length,
    water = game.living().filter((p) => rations[p.id]?.water).length;
  return `<div class="ration-summary ${food > game.stock.food || water > game.stock.water ? "warning" : ""}"><span>오늘 배급 예정</span><b>식량 ${food} / ${game.stock.food} <em>·</em> 물 ${water} / ${game.stock.water}</b>${food > game.stock.food || water > game.stock.water ? "<small>재고 부족 · 일부 인원은 배급받지 못합니다.</small>" : ""}</div>`;
}
function routesPanel() {
  return `<section class="panel routes-panel"><div class="panel-heading"><h2>${icon("flag")}살아나갈 길</h2><span class="tag">2 ENDINGS</span></div>${game
    .routeInfo()
    .map(
      (r) =>
        `<article class="route"><div><span>${icon(r.id === "rescue" ? "radio" : "users")}<b>${r.name}</b></span><small>${r.step === 0 ? "미개방" : r.step === 1 ? "연락 중" : "마지막 단계"}</small></div><div class="route-steps">${[0, 1, 2].map((i) => `<i class="${i <= r.step ? "on" : ""}"></i>`).join("")}</div><p>${r.text}</p></article>`,
    )
    .join(
      "",
    )}<p class="route-note">열린 경로의 후속 연락은 1~3일 뒤부터 발생하며, 기한이 지난 연락을 우선 처리합니다.</p></section>`;
}
function shelter() {
  return `${titlebar("THE SAFE HOUSE / ONE MORE DAY", "오늘도, 문을 잠갔다.", "물자를 나누고, 상처를 살피고, 다음 날을 선택하세요.", `<div class="day-stamp">${icon("sun")}<span>DAY <b>${String(game.day).padStart(2, "0")}</b></span></div>`)}${resources()}<div class="shelter-grid"><div><section class="home-scene">${houseArt()}<div class="home-scene-caption"><div><span class="tag">${game.stock.radio ? "무전기 연결됨" : "무전기 없음"}</span><h2>완벽하진 않아도, 우리의 집.</h2></div><span>보급 ${game.trip}회<br>생존 ${game.day}일째</span></div></section>${peoplePanel()}<div class="day-actions"><div><b>하루를 넘기기 전에</b><p>체크한 사람에게만 식량과 물이 배급됩니다.</p></div>${button(`배급하고 다음 날로 ${icon("arrow")}`, "next-day")}</div></div><aside>${routesPanel()}<section class="panel resupply-panel"><div class="eyebrow">THE NEXT SUPPLY RUN</div><h3>${icon("bag")}다시 나갈 준비가 됐나요?</h3><p>집을 나서는 순간부터 왕복 60초.<br>마트의 남은 물자는 다시 채워지지 않습니다.</p>${button(`추가 보급 출발 ${icon("arrow")}`, "start", "secondary full", game.loot.every((l) => !l.count) ? "disabled" : "")}<small>가방 0 / 4칸 · 마트 잔여 ${game.loot.reduce((s, l) => s + l.count, 0)}개</small></section><section class="recent-log"><div class="panel-heading"><h2>집의 기록</h2><button data-action="journal" class="text-button">전체 보기 ↗</button></div>${game.journal
    .slice(0, 3)
    .map(
      (l) =>
        `<div class="log-entry"><span>D${String(l.day).padStart(2, "0")}</span><p>${l.message}</p></div>`,
    )
    .join("")}</section></aside></div>`;
}
function familyModal() {
  const f = FAMILY[game.familyIndex];
  return `<div class="modal-backdrop"><section class="modal family-modal" role="dialog" aria-modal="true" aria-labelledby="family-title"><div class="eyebrow">AT YOUR DOOR / ${game.familyIndex + 1} OF 3</div><div class="family-heading">${portrait({ ...f, alive: true }, true)}<div><span class="tag">가족의 선택</span><h2 id="family-title">${f.name}를 데려올까요?</h2><p>${f.role}</p></div></div><p class="modal-story">${["담장 옆에서 지우가 조용히 손을 흔듭니다. “돌아올 줄 알았어. 다친 데는 없어?”", "차고 뒤에 숨어 있던 준이 나타납니다. 손에는 낡은 장갑뿐입니다. “문이라도 고쳐 줄 수 있어.”", "현관 계단 밑에서 은이 고개를 듭니다. “아빠, 밖에서 무슨 소리가 들렸어.”"][game.familyIndex]}</p><div class="family-tradeoff"><span>${icon("water")} 매일 식량 1 + 물 1 추가 필요</span><span>${icon("heart")} ${f.skill}</span></div><div class="modal-actions">${button("함께 집에 들어간다", "family-yes", "primary")}${button("데려오지 않는다", "family-no", "ghost")}</div><small class="muted">이번 선택은 되돌릴 수 없습니다. 가족 선택 중에는 시간이 흐르지 않습니다.</small></section></div>`;
}
function eventModal() {
  const e = game.getEvent();
  return `<div class="modal-backdrop"><section class="modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-title"><div class="event-symbol">${icon(e.tag.includes("RESCUE") || e.tag.includes("RADIO") ? "radio" : e.tag.includes("DANGER") ? "skull" : "note")}</div><div class="eyebrow">DAY ${String(game.day).padStart(2, "0")} / ${e.tag}</div><h2 id="event-title">${e.title}</h2><p class="modal-story">${e.text}</p><div class="event-options">${e.options.map((o) => `<button data-action="event" data-choice="${o.id}" ${o.enabled ? "" : "disabled"}><span><b>${o.label}</b><small>${o.description}${o.enabled ? "" : " · 조건 미충족"}</small></span>${icon("arrow")}</button>`).join("")}</div><div class="modal-footnote"><span class="live-dot"></span> 선택의 결과는 생존 기록에 남습니다.</div></section></div>`;
}
function ending() {
  const e = game.ending;
  let best = 0;
  try {
    best = Number(localStorage.getItem("60home-best") || 0);
    if (game.day > best) {
      localStorage.setItem("60home-best", String(game.day));
      best = game.day;
    }
  } catch {
    /* Storage is optional; private browsing still supports the full game. */
  }
  return `<section class="ending-screen"><div class="eyebrow">${e.won ? "ANOTHER MORNING" : "THE STORY ENDS HERE"}</div><div class="ending-symbol">${icon(e.won ? "sun" : "skull")}</div><span class="tag">${e.won ? "생존 성공 / " + (e.route === "rescue" ? "RESCUED" : "A NEW COMMUNITY") : "생존 실패 / " + (game.remaining === 0 ? "TIME IS UP" : "NOT THIS TIME")}</span><h1>${e.title}</h1><p>${e.text}</p><div class="ending-stats"><div><span>함께 버틴 시간</span><b>${game.day}<small>일</small></b></div><div><span>돌아온 보급</span><b>${game.completedTrips}<small>회</small></b></div><div><span>남은 생존자</span><b>${alive()}<small>명</small></b></div></div><div class="ending-family">${
    game.people
      .filter((p) => p.id !== "you")
      .map((p) => `<span>${p.name} · ${p.alive ? "함께" : "기억 속에"}</span>`)
      .join("") || "<span>혼자 걸어온 길</span>"
  }</div>${button(`새로운 이야기 시작 ${icon("arrow")}`, "restart")}<button class="text-button" data-action="journal">이번 생존 기록 보기 ↗</button><small>다시 시작하면 물자와 가족 선택, 사건 일정이 모두 새로 시작됩니다. · 최장 생존 ${best}일</small></section>`;
}
function helpModal() {
  return `<div class="modal-backdrop"><section class="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="modal-close icon-button" data-action="help" aria-label="닫기">${icon("close")}</button><div class="eyebrow">A SMALL GUIDE TO STAYING ALIVE</div><h2 id="help-title">집으로 돌아오는 법.</h2><ol><li><b>마트에서 60초.</b> 진열대 아이콘을 누르면 이동 후 자동 수집합니다. 바닥을 클릭하거나 WASD / 방향키로 이동하고, E로 가까운 물품을 집을 수 있습니다. 집 아이콘이나 귀가 버튼으로 돌아오세요.</li><li><b>작은 물품 1칸, 큰 물품 2칸.</b> 가방은 총 4칸. 담긴 물품을 누르면 원래 진열대로 반환합니다. 수집하는 0.8초도 제한 시간에 포함됩니다.</li><li><b>시간은 멈추지 않습니다.</b> 도움말이나 다른 탭을 열어도 보급의 60초는 계속 흐릅니다. 집에서는 다음 날 버튼을 누를 때만 하루가 흐릅니다.</li><li><b>가족 한 명마다 식량 1 + 물 1.</b> 허기 3일째부터 체력 −1, 갈증 2일째부터 −2, 부상은 매일 −1. 나의 체력이 0이면 패배합니다. 구급약은 1회분씩 사용합니다.</li><li><b>기다리는 것만으로는 탈출할 수 없습니다.</b> 무전기 → 구조대 응답 → 인원수만큼 물자 전달 → 최종 호출. 또는 이웃 교섭 → 수리 / 기부 → 공동체 합류. 열린 경로는 오른쪽에서 확인하세요.</li><li><b>조용한 날은 최대 ${MAX_QUIET_DAYS}일 연속.</b> 후속 사건은 앞 단계를 마친 뒤 예약됩니다. 물자가 부족하면 연기 후 다시 도전할 수 있습니다.</li></ol>${button("기억할게요", "help", "secondary full")}</section></div>`;
}
function journalModal() {
  return `<div class="modal-backdrop"><section class="modal journal-modal" role="dialog" aria-modal="true" aria-labelledby="journal-title"><button class="modal-close icon-button" data-action="journal" aria-label="닫기">${icon("close")}</button><div class="eyebrow">EVERY CHOICE LEAVES A TRACE</div><h2 id="journal-title">우리의 생존 기록.</h2><div class="journal-scroll">${game.journal.map((l) => `<div class="log-entry"><span>DAY ${String(l.day).padStart(2, "0")}</span><p>${l.message}</p></div>`).join("")}</div></section></div>`;
}
function resetRations() {
  rations = Object.fromEntries(
    game.living().map((p) => [p.id, { food: true, water: true }]),
  );
}
function render() {
  const phase = game.phase;
  app.innerHTML = `${header()}<div class="layout">${sidebar()}<main>${phase === "intro" ? intro() : phase === "expedition" ? expedition() : phase === "end" ? ending() : shelter()}<footer class="page-footer"><span>60 SECOND : HOME</span><span>작은 선택들이 모여, 내일이 된다.</span><span>FIRST LIGHT EDITION / 01</span></footer></main></div>${phase === "family" ? familyModal() : phase === "event" ? eventModal() : ""}${helpOpen ? helpModal() : ""}${journalOpen ? journalModal() : ""}`;
  if (phase === "expedition") drawFrame();
  const modal = [...app.querySelectorAll('[role="dialog"]')].at(-1);
  if (modal)
    modal
      .querySelector("button:not([disabled])")
      ?.focus({ preventScroll: true });
}
function drawFrame() {
  const h = document.querySelector("#header-clock");
  if (h) {
    h.innerHTML = clock();
    h.closest(".header-timer").classList.toggle("urgent", game.remaining <= 15);
  }
  const c = document.querySelector("#clock");
  if (c) {
    c.innerHTML = clock();
    c.closest(".timer-box").classList.toggle("urgent", game.remaining <= 15);
  }
  for (const key of ["player", "zombie"]) {
    const el = document.getElementById(key),
      p = game[key];
    if (el && p)
      el.setAttribute(
        "transform",
        `translate(${p.x * 32 + 16},${p.y * 32 + 16})`,
      );
  }
  const p = document.getElementById("walk-path");
  if (p)
    p.setAttribute(
      "d",
      game.player.path.length
        ? `M${game.player.x * 32 + 16},${game.player.y * 32 + 16} ` +
            game.player.path
              .map((n) => `L${n.x * 32 + 16},${n.y * 32 + 16}`)
              .join(" ")
        : "",
    );
  const n = document.querySelector("#notice span");
  if (n) n.textContent = game.notice;
}
function syncTime() {
  const now = performance.now();
  game.update((now - lastTime) / 1000);
  lastTime = now;
}
app.addEventListener("click", (event) => {
  if (event.target.closest(".brand")) {
    event.preventDefault();
    return;
  }
  const loot = event.target.closest("[data-loot]");
  if (loot) {
    syncTime();
    if (game.phase !== "expedition") {
      render();
      return;
    }
    selectedLoot = Number(loot.dataset.loot);
    game.goLoot(selectedLoot);
    render();
    return;
  }
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    syncTime();
    const action = actionEl.dataset.action;
    if (action === "help") helpOpen = !helpOpen;
    if (action === "journal") journalOpen = !journalOpen;
    if (action === "start") {
      game.startTrip();
      keys.clear();
      helpOpen = false;
      journalOpen = false;
    }
    if (action === "select-loot") selectedLoot = Number(actionEl.dataset.id);
    if (action === "collect") game.goLoot(selectedLoot);
    if (action === "home") game.walkTo(HOME.x, HOME.y);
    if (action === "drop") game.drop(Number(actionEl.dataset.index));
    if (action === "family-yes" || action === "family-no") {
      game.chooseFamily(action === "family-yes");
      resetRations();
    }
    if (action === "heal") game.heal(actionEl.dataset.id);
    if (action === "next-day") {
      game.advanceDay(rations);
      resetRations();
    }
    if (action === "event") game.chooseEvent(actionEl.dataset.choice);
    if (action === "restart") {
      game = new Game();
      rations = {};
      selectedLoot = 0;
      helpOpen = false;
      journalOpen = false;
      keys.clear();
    }
    render();
    return;
  }
  const world = event.target.closest("#world");
  if (world && game.phase === "expedition") {
    syncTime();
    if (game.phase !== "expedition") {
      render();
      return;
    }
    const rect = world.getBoundingClientRect(),
      x = Math.floor(((event.clientX - rect.left) / rect.width) * COLS),
      y = Math.floor(((event.clientY - rect.top) / rect.height) * ROWS);
    game.walkTo(x, y);
    drawFrame();
  }
});
app.addEventListener("change", (e) => {
  if (e.target.dataset.ration) {
    const { ration, resource } = e.target.dataset;
    rations[ration] ??= {};
    rations[ration][resource] = e.target.checked;
    document.querySelector("#ration-summary").innerHTML = rationSummary();
  }
});
app.addEventListener("keydown", (e) => {
  if (
    (e.key === "Enter" || e.key === " ") &&
    e.target.matches("[data-loot],.home-target")
  ) {
    e.preventDefault();
    e.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (helpOpen || journalOpen) {
      helpOpen = false;
      journalOpen = false;
      render();
    }
    return;
  }
  if (game.phase !== "expedition" || helpOpen || journalOpen) return;
  const k = e.key.toLowerCase();
  if (
    [
      "w",
      "a",
      "s",
      "d",
      "arrowup",
      "arrowdown",
      "arrowleft",
      "arrowright",
      "e",
    ].includes(k)
  ) {
    e.preventDefault();
    syncTime();
    if (game.phase !== "expedition") {
      render();
      return;
    }
    keys.add(k);
    if (k === "e") {
      const nearest = game.loot
        .filter((l) => l.count > 0)
        .sort(
          (a, b) =>
            Math.hypot(a.x - game.player.x, a.y - game.player.y) -
            Math.hypot(b.x - game.player.x, b.y - game.player.y),
        )[0];
      if (
        nearest &&
        Math.hypot(nearest.x - game.player.x, nearest.y - game.player.y) < 1.5
      ) {
        selectedLoot = nearest.id;
        game.goLoot(nearest.id);
      }
    }
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
// Trap keyboard focus within the currently visible dialog.
window.addEventListener("keydown", (e) => {
  if (e.key !== "Tab") return;
  const dialogs = [...document.querySelectorAll('[role="dialog"]')];
  const modal = dialogs.at(-1);
  if (!modal) return;
  const focusable = [
    ...modal.querySelectorAll('button:not([disabled]),[tabindex="0"]'),
  ];
  const first = focusable[0],
    last = focusable.at(-1);
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last?.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first?.focus();
  }
});
let lastTime = performance.now();
render();
function frame(now) {
  const before = game.phase,
    bag = game.bag.join(",");
  game.update((now - lastTime) / 1000);
  lastTime = now;
  if (game.phase === "expedition" && !helpOpen && !journalOpen) {
    if (!game.player.path.length && !game.lootTimer) {
      const x = Math.round(game.player.x),
        y = Math.round(game.player.y);
      const dir =
        keys.has("w") || keys.has("arrowup")
          ? [0, -1]
          : keys.has("s") || keys.has("arrowdown")
            ? [0, 1]
            : keys.has("a") || keys.has("arrowleft")
              ? [-1, 0]
              : keys.has("d") || keys.has("arrowright")
                ? [1, 0]
                : null;
      if (dir && !blocked(x + dir[0], y + dir[1]))
        game.walkTo(x + dir[0], y + dir[1]);
    }
  }
  if (before !== game.phase || bag !== game.bag.join(",")) {
    if (game.phase === "family" || game.phase === "shelter") resetRations();
    render();
  } else if (game.phase === "expedition") drawFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
