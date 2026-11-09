// Pure game rules. No DOM or wall clock: a seeded random source and elapsed time
// make inventory, scheduling, and outcomes reproducible in tests.
export const CAPACITY = 4;
export const TRIP_SECONDS = 60;
export const MAX_QUIET_DAYS = 2;
export const COLS = 30;
export const ROWS = 16;
export const HOME = { x: 28, y: 8 };
export const ITEMS = {
  food: {
    name: "통조림",
    slots: 1,
    resource: "food",
    amount: 4,
    icon: "can",
    detail: "식량 4인분",
    color: "#d2a66b",
  },
  foodbox: {
    name: "비상식량 상자",
    slots: 2,
    resource: "food",
    amount: 10,
    icon: "box",
    detail: "식량 10인분",
    color: "#d2a66b",
  },
  water: {
    name: "생수 묶음",
    slots: 1,
    resource: "water",
    amount: 4,
    icon: "water",
    detail: "물 4인분",
    color: "#8cafb2",
  },
  watercan: {
    name: "대형 물통",
    slots: 2,
    resource: "water",
    amount: 10,
    icon: "water",
    detail: "물 10인분",
    color: "#8cafb2",
  },
  medkit: {
    name: "대형 구급상자",
    slots: 2,
    resource: "medicine",
    amount: 4,
    icon: "med",
    detail: "치료 4회분",
    color: "#ce8173",
  },
  radio: {
    name: "휴대용 무전기",
    slots: 2,
    resource: "radio",
    amount: 1,
    icon: "radio",
    detail: "구조 무전 경로 해금",
    color: "#c0be92",
  },
  tools: {
    name: "공구 세트",
    slots: 1,
    resource: "tools",
    amount: 1,
    icon: "tools",
    detail: "방어 / 공동체 합류",
    color: "#b5b6b0",
  },
};
export const FAMILY = [
  {
    id: "jiwoo",
    name: "지우",
    role: "배우자 · 간호사",
    skill: "치료 효과 +1 · 부상 사건에 대처",
    initial: "지",
    color: "#a4b9a3",
  },
  {
    id: "jun",
    name: "준",
    role: "동생 · 정비사",
    skill: "도구 없이도 방어 · 공동체 수리 지원",
    initial: "준",
    color: "#c4a887",
  },
  {
    id: "eun",
    name: "은",
    role: "딸 · 관찰자",
    skill: "위험 조기 발견 · 안전한 신호 전달",
    initial: "은",
    color: "#bba5ad",
  },
];
export const SHELVES = [
  { x: 3, y: 3, w: 4, h: 3, label: "CANNED FOOD" },
  { x: 9, y: 3, w: 4, h: 3, label: "DRINKS" },
  { x: 3, y: 10, w: 4, h: 3, label: "FIRST AID" },
  { x: 9, y: 10, w: 4, h: 3, label: "ELECTRONICS" },
];
export function blocked(x, y) {
  if (x <= 0 || y <= 0 || x >= COLS - 1 || y >= ROWS - 1) return true;
  if (
    SHELVES.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  )
    return true;
  if (x === 18 && y !== 7 && y !== 8) return true;
  if (
    (x >= 26 && (y === 5 || y === 11)) ||
    (x === 26 && y > 5 && y < 11 && y !== 8)
  )
    return true;
  if ((x === 23 && y >= 2 && y <= 5) || (x === 21 && y >= 11 && y <= 13))
    return true;
  return false;
}
export function findPath(from, to) {
  const start = { x: Math.round(from.x), y: Math.round(from.y) },
    end = { x: Math.round(to.x), y: Math.round(to.y) };
  if (blocked(end.x, end.y)) return [];
  const key = (p) => `${p.x},${p.y}`,
    queue = [start],
    seen = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    if (p.x === end.x && p.y === end.y) {
      const path = [];
      let cur = p;
      while (cur) {
        path.unshift(cur);
        cur = seen.get(key(cur));
      }
      return path;
    }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (!blocked(n.x, n.y) && !seen.has(key(n))) {
        seen.set(key(n), p);
        queue.push(n);
      }
    }
  }
  return [];
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const person = (data) => ({
  ...data,
  health: 5,
  hunger: 0,
  thirst: 0,
  injured: false,
  alive: true,
});
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Game {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0;
    this.random = seededRandom(this.seed);
    this.phase = "intro";
    this.day = 1;
    this.trip = 0;
    this.completedTrips = 0;
    this.stock = { food: 8, water: 8, medicine: 0, radio: 0, tools: 0 };
    this.bag = [];
    this.people = [
      person({
        id: "you",
        name: "나",
        role: "생존자",
        initial: "나",
        color: "#dbb989",
      }),
    ];
    this.familyIndex = 0;
    this.familyDecisions = [];
    this.routes = { rescue: "locked", community: "locked" };
    this.queue = [];
    this.quietDays = 0;
    this.history = [];
    this.journal = [];
    this.event = null;
    this.notice = "";
    this.ending = null;
    this.loot = [
      ["food", 2, 4, 3],
      ["foodbox", 8, 4, 2],
      ["water", 14, 4, 4],
      ["medkit", 2, 11, 2],
      ["radio", 8, 11, 1],
      ["tools", 14, 11, 3],
      ["watercan", 15, 6, 2],
      ["food", 6, 8, 3],
      ["water", 11, 8, 3],
      ["foodbox", 15, 13, 1],
    ].map(([type, x, y, count], id) => ({ id, type, x, y, count }));
    this.schedule("radio", this.roll(2, 4));
    this.schedule("community", this.roll(3, 5));
    this.schedule("raid", this.roll(2, 5));
    this.schedule("trader", this.roll(1, 4));
    this.schedule("injury", this.roll(3, 6));
    this.addLog(
      "집의 비상식량과 물은 각각 8인분. 더 챙길 수 있는 시간은 단 60초.",
    );
  }
  roll(min, max) {
    return min + Math.floor(this.random() * (max - min + 1));
  }
  addLog(message) {
    this.journal.unshift({ day: this.day, message });
    this.journal = this.journal.slice(0, 60);
  }
  living() {
    return this.people.filter((p) => p.alive);
  }
  has(id) {
    return this.people.some((p) => p.id === id && p.alive);
  }
  get usedSlots() {
    return this.bag.reduce((n, type) => n + ITEMS[type].slots, 0);
  }
  schedule(id, due) {
    if (!this.queue.some((e) => e.id === id))
      this.queue.push({ id, due, latest: due + 2 });
  }
  startTrip() {
    if (!["intro", "shelter"].includes(this.phase)) return false;
    this.trip++;
    this.phase = "expedition";
    this.remaining = TRIP_SECONDS;
    this.elapsed = 0;
    this.bag = [];
    this.pickupTarget = null;
    this.lootTimer = 0;
    this.player = { ...(this.trip === 1 ? { x: 4, y: 8 } : HOME), path: [] };
    this.zombie = { x: 1, y: 1, path: [] };
    this.zombieClock = 0;
    this.leftHome = this.trip === 1;
    this.notice =
      this.trip === 1
        ? "진열대를 눌러 수집하세요. 집에 도착하기까지 60초!"
        : "지금부터 왕복 60초. 마트까지 가는 시간도 포함됩니다.";
    return true;
  }
  walkTo(x, y) {
    if (this.phase !== "expedition" || this.lootTimer > 0) return false;
    const path = findPath(this.player, { x, y });
    if (!path.length) {
      this.notice = "진열대나 벽을 통과할 수 없습니다.";
      return false;
    }
    this.player.path = path;
    this.pickupTarget = null;
    return true;
  }
  goLoot(id) {
    if (this.phase !== "expedition") return false;
    const item = this.loot.find((l) => l.id === id);
    if (!item || !item.count) {
      this.notice = "이 진열대는 비었습니다.";
      return false;
    }
    if (this.usedSlots + ITEMS[item.type].slots > CAPACITY) {
      this.notice = `공간 부족 · ${ITEMS[item.type].name}에 ${ITEMS[item.type].slots}칸이 필요합니다.`;
      return false;
    }
    if (this.walkTo(item.x, item.y)) {
      this.pickupTarget = id;
      this.notice = `${ITEMS[item.type].name} 수집 지점으로 이동 중 · 도착 후 0.8초`;
      return true;
    }
    return false;
  }
  pickup(id) {
    if (this.phase !== "expedition") return false;
    const item = this.loot.find((l) => l.id === id);
    if (
      !item ||
      item.count <= 0 ||
      distance(this.player, item) > 0.8 ||
      this.usedSlots + ITEMS[item.type].slots > CAPACITY
    )
      return false;
    this.bag.push(item.type);
    item.count--;
    this.notice = `${ITEMS[item.type].name} 수집 · ${this.usedSlots}/4칸 사용`;
    return true;
  }
  drop(index) {
    if (this.phase !== "expedition" || !this.bag[index]) return;
    const [type] = this.bag.splice(index, 1);
    const shelf = this.loot.find((l) => l.type === type);
    shelf.count++;
    this.notice = "물품을 진열대에 되돌려 놓았습니다.";
  }
  move(actor, amount) {
    while (amount > 0 && actor.path.length) {
      const target = actor.path[0],
        dist = distance(actor, target);
      if (dist <= amount) {
        actor.x = target.x;
        actor.y = target.y;
        actor.path.shift();
        amount -= dist;
      } else {
        actor.x += ((target.x - actor.x) / dist) * amount;
        actor.y += ((target.y - actor.y) / dist) * amount;
        amount = 0;
      }
    }
  }
  update(seconds) {
    if (
      this.phase !== "expedition" ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    )
      return;
    // Substeps prevent a background tab / delayed animation frame from bypassing
    // collisions or the deadline. The wall-clock elapsed time is never discarded.
    let left = seconds;
    while (left > 0 && this.phase === "expedition") {
      const dt = Math.min(left, 0.05);
      left -= dt;
      this.remaining = Math.max(0, this.remaining - dt);
      this.elapsed += dt;
      if (this.remaining <= 0.000001) {
        this.remaining = 0;
        this.lose(
          "시간 초과",
          "문 앞까지 닿지 못했다. 60초가 지나고, 거리의 소리가 우리를 덮쳤다.",
        );
        break;
      }
      this.move(this.player, dt * (3.5 - this.usedSlots * 0.08));
      if (distance(this.player, HOME) > 1.5) this.leftHome = true;
      if (this.leftHome && distance(this.player, HOME) < 0.25) {
        this.arriveHome();
        break;
      }
      this.zombieClock -= dt;
      if (this.zombieClock <= 0) {
        const anchor = this.zombie.path[0] || this.zombie;
        this.zombie.path = findPath(anchor, this.player);
        this.zombieClock = 0.4;
      }
      this.move(
        this.zombie,
        dt *
          (1.05 +
            Math.min(0.75, this.elapsed * 0.012) +
            Math.min(0.25, (this.trip - 1) * 0.03)),
      );
      if (distance(this.player, this.zombie) < 0.6) {
        this.lose(
          "붙잡혔다",
          "뒤를 돌아볼 틈도 없었다. 물자보다, 집으로 돌아갈 시간이 더 필요했다.",
        );
        break;
      }
      if (this.pickupTarget !== null && !this.player.path.length) {
        this.lootTimer += dt;
        if (this.lootTimer >= 0.8) {
          this.pickup(this.pickupTarget);
          this.pickupTarget = null;
          this.lootTimer = 0;
        }
      }
    }
  }
  arriveHome() {
    if (this.phase !== "expedition") return;
    this.completedTrips++;
    const delivered = this.bag.map((type) => ITEMS[type].name);
    for (const type of this.bag) {
      const i = ITEMS[type];
      this.stock[i.resource] += i.amount;
    }
    this.bag = [];
    this.player.path = [];
    this.pickupTarget = null;
    this.lootTimer = 0;
    this.addLog(
      `보급 ${this.trip}회차 귀가 · ${delivered.join(", ") || "빈손"} · ${Math.ceil(this.remaining)}초 남김`,
    );
    this.phase = this.trip === 1 ? "family" : "shelter";
    this.notice = "물품이 집 재고로 옮겨졌습니다. 가방은 다시 비었습니다.";
  }
  chooseFamily(rescue) {
    if (this.phase !== "family") return;
    const f = FAMILY[this.familyIndex];
    this.familyDecisions.push({ id: f.id, rescued: rescue });
    if (rescue) {
      this.people.push(person(f));
      this.addLog(`${f.name}와 함께 집으로 들어왔다.`);
    } else this.addLog(`${f.name}를 데려오지 못했다. 그 선택을 기억한다.`);
    this.familyIndex++;
    if (this.familyIndex === FAMILY.length) this.phase = "shelter";
  }
  heal(id) {
    if (this.phase !== "shelter" || this.stock.medicine < 1) return false;
    const p = this.people.find((p) => p.id === id && p.alive);
    if (!p || (!p.injured && p.health === 5)) return false;
    this.stock.medicine--;
    p.health = Math.min(5, p.health + (this.has("jiwoo") ? 3 : 2));
    p.injured = false;
    this.addLog(`${p.name} 치료 · 구급약 1회 사용`);
    return true;
  }
  advanceDay(rations = {}) {
    if (this.phase !== "shelter") return false;
    // Explicit person order, displayed in the UI, handles limited supplies fairly
    // and visibly. Missing entries mean no ration, never an implicit free meal.
    for (const p of this.living()) {
      const portion = rations[p.id] || {};
      const fed = portion.food && this.stock.food >= 1,
        watered = portion.water && this.stock.water >= 1;
      if (fed) {
        this.stock.food--;
        p.hunger = 0;
      } else p.hunger++;
      if (watered) {
        this.stock.water--;
        p.thirst = 0;
      } else p.thirst++;
      if (p.hunger >= 3) p.health--;
      if (p.thirst >= 2) p.health -= 2;
      if (p.injured) p.health--;
      if (p.health <= 0) {
        p.health = 0;
        p.alive = false;
        this.addLog(`${p.name}의 자리가 비었다. 물과 식량, 치료가 필요했다.`);
      }
    }
    if (!this.has("you")) {
      this.lose(
        "마지막 밤",
        "몸이 더는 버티지 못했다. 남겨진 식량보다 나눠야 했던 순간이 떠올랐다.",
      );
      return true;
    }
    this.day++;
    this.addLog(`${this.day}일째 아침. 생존자 ${this.living().length}명.`);
    this.nextEvent();
    return true;
  }
  eligible(id) {
    if (id === "radio")
      return this.stock.radio > 0 && this.routes.rescue === "locked";
    if (id === "community") return this.routes.community === "locked";
    if (id === "rescueBrief") return this.routes.rescue === "contacted";
    if (id === "rescuePickup") return this.routes.rescue === "prepared";
    if (id === "communityTask") return this.routes.community === "invited";
    if (id === "communityJoin") return this.routes.community === "trusted";
    return true;
  }
  nextEvent() {
    const available = this.queue.filter((e) => this.eligible(e.id));
    const urgent = available
      .filter((e) => e.latest <= this.day)
      .sort((a, b) => a.latest - b.latest);
    const due = available
      .filter((e) => e.due <= this.day)
      .sort((a, b) => a.latest - b.latest);
    let chosen = urgent[0] || due[0];
    if (!chosen && this.quietDays >= MAX_QUIET_DAYS)
      chosen = available.sort((a, b) => a.due - b.due)[0] || {
        id: "quietNoise",
      };
    if (chosen) {
      this.queue = this.queue.filter((e) => e !== chosen);
      this.event = { id: chosen.id };
      this.phase = "event";
      this.quietDays = 0;
      this.history.push({ day: this.day, id: chosen.id });
    } else {
      this.quietDays++;
      this.phase = "shelter";
      this.addLog("조용한 하루. 잠깐의 고요 속에 숨을 고른다.");
    }
  }
  getEvent() {
    if (!this.event) return null;
    const count = this.living().length;
    const option = (id, label, description, enabled = true) => ({
      id,
      label,
      description,
      enabled,
    });
    const events = {
      radio: {
        tag: "RADIO SIGNAL",
        title: "잡음 사이의 목소리",
        text: "“생존자가 있다면 응답하라.” 북쪽 구조대의 신호다. 무전기로 위치를 알리면, 다음 연락에서 탈출 준비를 전달한다고 한다.",
        options: [
          option(
            "answer",
            "구조대에 응답한다",
            "구조 경로 개방 · 무전기는 계속 보관",
            this.stock.radio > 0,
          ),
          option(
            "ignore",
            "이번 신호를 넘긴다",
            "다음 신호는 2~4일 후 다시 시도",
          ),
        ],
      },
      rescueBrief: {
        tag: "RESCUE / 02",
        title: "구조대의 요구",
        text: `“각자 마실 물과 식량을 준비하고, 지붕에서 신호를 보내라.” 현재 생존자 ${count}명. 식량 ${count} + 물 ${count}인분이 필요하다. 은이 있다면 안전하게 신호를 보낼 수 있다.`,
        options: [
          option(
            "prepare",
            "탈출 물자를 묶고 신호를 보낸다",
            `식량 −${count} / 물 −${count}${this.has("eun") ? " · 은이 안전한 길을 찾음" : " · 옥상에서 나의 경미한 부상"}`,
            this.stock.food >= count &&
              this.stock.water >= count &&
              this.stock.radio > 0,
          ),
          option(
            "wait",
            "물자를 더 모은 뒤 다시 연락한다",
            "경로 유지 · 1~2일 후 준비 기회 재발생",
          ),
        ],
      },
      rescuePickup: {
        tag: "RESCUE / FINAL",
        title: "마지막 호출",
        text: "골목 끝에서 엔진 소리가 들린다. “준비한 사람 모두 탑승하라.” 준비해 둔 물자는 이미 구조대에 전달했다. 이제 돌아갈 수 없는 선택이다.",
        options: [
          option("leave", "모두 데리고 구조 차량에 탄다", "결말 · 새벽의 구조"),
          option("stay", "아직 여기에 남는다", "경로 유지 · 1~2일 후 재호출"),
        ],
      },
      community: {
        tag: "THE NEIGHBORS",
        title: "담장 너머의 사람들",
        text: "이웃 생존자들이 오래된 학교에 거점을 세웠다. “같이 버티려면 서로를 믿을 이유가 필요해요.” 교섭을 시작하면 곧 필요한 도움을 알려준다고 한다.",
        options: [
          option("talk", "공동체와 교섭을 시작한다", "공동체 합류 경로 개방"),
          option("refuse", "지금은 문을 열지 않는다", "2~4일 후 다시 제안"),
        ],
      },
      communityTask: {
        tag: "COMMUNITY / 02",
        title: "신뢰를 만드는 일",
        text: "학교의 급수 펌프가 멈췄다. 준의 기술이나 공구 세트가 있다면 수리를 도울 수 있다. 그 대신 식량과 물을 기부해 신뢰를 얻을 수도 있다.",
        options: [
          option(
            "repair",
            "펌프 수리를 돕는다",
            this.has("jun") ? "준이 수리 · 물품 소모 없음" : "공구 세트 −1",
            this.has("jun") || this.stock.tools > 0,
          ),
          option(
            "donate",
            "물자를 기부한다",
            "식량 −4 / 물 −4",
            this.stock.food >= 4 && this.stock.water >= 4,
          ),
          option(
            "wait",
            "보급 후 다시 찾아간다",
            "경로 유지 · 1~2일 후 재교섭",
          ),
        ],
      },
      communityJoin: {
        tag: "COMMUNITY / FINAL",
        title: "우리를 위한 자리",
        text: "학교에서 초록색 천을 내걸었다. “여러분 덕분에 물이 돌아왔어요. 가족 모두를 위한 자리를 마련했습니다.” 문을 나서면 이 집과는 작별이다.",
        options: [
          option(
            "join",
            "가족과 함께 공동체로 간다",
            "결말 · 함께 만드는 내일",
          ),
          option("stay", "조금 더 준비한다", "경로 유지 · 1~2일 후 다시 초대"),
        ],
      },
      raid: {
        tag: "DANGER AT THE DOOR",
        title: "문이 버티는 동안",
        text: "현관문 너머에서 손톱 긁는 소리가 난다. 낡은 경첩이 비명을 지른다. 누군가 문을 지켜야 한다.",
        options: [
          option(
            "defend",
            "준에게 방어를 맡긴다",
            "부상 없이 침입 저지",
            this.has("jun"),
          ),
          option(
            "barricade",
            "공구로 문을 보강한다",
            "공구 세트 −1",
            this.stock.tools > 0,
          ),
          option("hide", "직접 문을 막고 버틴다", "나의 체력 −1 · 부상"),
        ],
      },
      trader: {
        tag: "A KNOCK, NOT A SCRATCH",
        title: "낯선 이의 거래",
        text: "한 생존자가 두 손을 보여 준다. 배낭에는 물과 구급약이 있다. 거래는 단 한 번, 문 앞에서만 이루어진다.",
        options: [
          option(
            "water",
            "식량 2인분을 물로 바꾼다",
            "식량 −2 / 물 +4",
            this.stock.food >= 2,
          ),
          option(
            "medicine",
            "물 2인분을 구급약으로 바꾼다",
            "물 −2 / 치료 +2회",
            this.stock.water >= 2,
          ),
          option("pass", "정중히 돌려보낸다", "재고 변화 없음"),
        ],
      },
      injury: {
        tag: "A SMALL WOUND",
        title: "작은 상처의 대가",
        text: "못에 긁힌 상처가 붉게 부어올랐다. 방치하면 매일 체력이 줄어든다. 가족의 도움이 절실한 순간이다.",
        options: [
          option(
            "nurse",
            "지우가 상처를 돌본다",
            "구급약 없이 회복",
            this.has("jiwoo"),
          ),
          option(
            "treat",
            "구급약을 사용한다",
            "치료 −1회",
            this.stock.medicine > 0,
          ),
          option("endure", "일단 천으로 감싼다", "나의 체력 −1 · 부상"),
        ],
      },
      quietNoise: {
        tag: "AFTER THE SILENCE",
        title: "어둠 속의 발소리",
        text: "밤새 집 주위를 맴도는 발소리. 이제는 누군가 지켜보고 있다는 걸 안다. 오늘의 선택은 내일을 조금 바꿀 수 있다.",
        options: [
          option(
            "watch",
            "은과 함께 안전한 길을 살핀다",
            "버려진 생수 발견 · 물 +2",
            this.has("eun"),
          ),
          option(
            "rest",
            "불을 끄고 번갈아 경계한다",
            "재고 변화 없이 밤을 넘김",
          ),
        ],
      },
    };
    return events[this.event.id];
  }
  chooseEvent(choice) {
    if (this.phase !== "event") return false;
    const definition = this.getEvent(),
      selected = definition.options.find((o) => o.id === choice);
    if (!selected?.enabled) return false;
    const id = this.event.id,
      me = this.people[0],
      count = this.living().length;
    this.addLog(`${definition.title} · ${selected.label}`);
    if (id === "radio") {
      if (choice === "answer") {
        this.routes.rescue = "contacted";
        this.schedule("rescueBrief", this.day + this.roll(1, 3));
      } else this.schedule("radio", this.day + this.roll(2, 4));
    }
    if (id === "rescueBrief") {
      if (choice === "prepare") {
        this.stock.food -= count;
        this.stock.water -= count;
        this.routes.rescue = "prepared";
        if (!this.has("eun")) {
          me.health--;
          me.injured = true;
        }
        this.schedule("rescuePickup", this.day + this.roll(1, 3));
      } else this.schedule("rescueBrief", this.day + this.roll(1, 2));
    }
    if (id === "rescuePickup") {
      if (choice === "leave")
        this.win(
          "rescue",
          "새벽의 구조",
          "무전의 잡음이 마침내 사람의 목소리가 되었다. 집은 뒤에 남았지만, 우리는 다음 아침을 향해 달린다.",
        );
      else this.schedule("rescuePickup", this.day + this.roll(1, 2));
    }
    if (id === "community") {
      if (choice === "talk") {
        this.routes.community = "invited";
        this.schedule("communityTask", this.day + this.roll(1, 3));
      } else this.schedule("community", this.day + this.roll(2, 4));
    }
    if (id === "communityTask") {
      if (choice === "repair" || choice === "donate") {
        if (choice === "repair" && !this.has("jun")) this.stock.tools--;
        if (choice === "donate") {
          this.stock.food -= 4;
          this.stock.water -= 4;
        }
        this.routes.community = "trusted";
        this.schedule("communityJoin", this.day + this.roll(1, 3));
      } else this.schedule("communityTask", this.day + this.roll(1, 2));
    }
    if (id === "communityJoin") {
      if (choice === "join")
        this.win(
          "community",
          "함께 만드는 내일",
          "학교의 문이 열리고, 낯선 이들이 우리 이름을 부른다. 혼자 버티는 밤은 끝났다. 이제 함께 살아갈 날들을 센다.",
        );
      else this.schedule("communityJoin", this.day + this.roll(1, 2));
    }
    if (id === "raid") {
      if (choice === "barricade") this.stock.tools--;
      if (choice === "hide") {
        me.health--;
        me.injured = true;
      }
      this.schedule("raid", this.day + this.roll(4, 7));
    }
    if (id === "trader") {
      if (choice === "water") {
        this.stock.food -= 2;
        this.stock.water += 4;
      }
      if (choice === "medicine") {
        this.stock.water -= 2;
        this.stock.medicine += 2;
      }
      this.schedule("trader", this.day + this.roll(3, 6));
    }
    if (id === "injury") {
      if (choice === "treat") this.stock.medicine--;
      if (choice === "nurse" || choice === "treat") {
        me.injured = false;
        me.health = Math.min(5, me.health + 1);
      } else {
        me.health--;
        me.injured = true;
      }
      this.schedule("injury", this.day + this.roll(5, 8));
    }
    if (id === "quietNoise" && choice === "watch") this.stock.water += 2;
    if (me.health <= 0 && this.phase !== "end") {
      me.alive = false;
      this.lose(
        "문 앞의 마지막 밤",
        "지킬 것이 많았다. 하지만 상처 입은 몸은 더 이상 버티지 못했다.",
      );
    }
    this.event = null;
    if (this.phase !== "end") this.phase = "shelter";
    return true;
  }
  routeInfo() {
    const rescue = {
      locked: "마트의 무전기를 가져오면 구조 신호에 응답할 수 있습니다.",
      contacted: "다음 구조 무전 대기 · 생존자 수만큼 식량과 물을 비축하세요.",
      prepared: "탈출 물자 전달 완료 · 구조 차량의 마지막 호출을 기다리세요.",
    };
    const community = {
      locked: "이웃 생존자의 교섭 제안을 기다리세요.",
      invited:
        "다음 교섭 대기 · 준 또는 공구 1개, 혹은 식량 4 + 물 4를 준비하세요.",
      trusted: "급수 펌프 복구 지원 완료 · 공동체의 초대를 기다리세요.",
    };
    return [
      {
        id: "rescue",
        name: "구조대 탈출",
        stage: this.routes.rescue,
        step: ["locked", "contacted", "prepared"].indexOf(this.routes.rescue),
        text: rescue[this.routes.rescue],
      },
      {
        id: "community",
        name: "공동체 합류",
        stage: this.routes.community,
        step: ["locked", "invited", "trusted"].indexOf(this.routes.community),
        text: community[this.routes.community],
      },
    ];
  }
  win(route, title, text) {
    this.phase = "end";
    this.ending = { won: true, route, title, text };
  }
  lose(title, text) {
    this.people[0].alive = false;
    this.people[0].health = 0;
    this.phase = "end";
    this.ending = { won: false, title, text };
  }
}
