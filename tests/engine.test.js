import test from "node:test";
import assert from "node:assert/strict";
import {
  Game,
  ITEMS,
  HOME,
  MAX_QUIET_DAYS,
  findPath,
  blocked,
} from "../src/engine.js";

function homeGame(family = [true, true, true], seed = 123) {
  const g = new Game(seed);
  g.startTrip();
  g.arriveHome();
  for (const yes of family) g.chooseFamily(yes);
  return g;
}
function feed(g) {
  return Object.fromEntries(
    g.living().map((p) => [p.id, { food: true, water: true }]),
  );
}
function stepUntil(g, condition, maxSeconds = 59) {
  for (
    let t = 0;
    t < maxSeconds && g.phase === "expedition" && !condition();
    t += 0.05
  )
    g.update(0.05);
  assert.ok(
    condition(),
    `condition not reached: phase=${g.phase}, notice=${g.notice}, remaining=${g.remaining}`,
  );
}
function collect(g, id) {
  const before = g.bag.length;
  assert.ok(g.goLoot(id));
  stepUntil(g, () => g.bag.length > before);
}
function resolveSafely(g, target) {
  if (g.phase !== "event") return;
  const id = g.event.id;
  const choices = {
    radio: target === "rescue" ? "answer" : "ignore",
    rescueBrief: "prepare",
    rescuePickup: target === "rescue" ? "leave" : "stay",
    community: target === "community" ? "talk" : "refuse",
    communityTask: "repair",
    communityJoin: target === "community" ? "join" : "stay",
    raid: "defend",
    trader: "pass",
    injury: "nurse",
    quietNoise: "watch",
  };
  assert.ok(
    g.chooseEvent(choices[id]),
    `${id}/${choices[id]} should be available`,
  );
}

test("items occupy 1 or 2 slots; overflow cannot remove shelf stock; dropping preserves stock", () => {
  const g = new Game(1);
  g.startTrip();
  for (const id of [3, 4]) {
    const l = g.loot[id];
    g.player = { x: l.x, y: l.y, path: [] };
    assert.ok(g.pickup(id));
  }
  assert.equal(g.usedSlots, 4);
  assert.deepEqual(g.bag, ["medkit", "radio"]);
  const l = g.loot[0],
    count = l.count;
  g.player = { x: l.x, y: l.y, path: [] };
  assert.equal(g.pickup(0), false);
  assert.equal(l.count, count);
  const radios = g.loot[4].count;
  g.drop(1);
  assert.equal(g.usedSlots, 2);
  assert.equal(g.loot[4].count, radios + 1);
  assert.ok(g.pickup(0));
  assert.equal(g.usedSlots, 3);
});

test("unloading applies item yields once, preserves finite market stock, empties bag, resets next trip", () => {
  const g = new Game(2);
  g.startTrip();
  for (const id of [3, 0, 2]) {
    g.player = { ...g.loot[id], path: [] };
    assert.ok(g.pickup(id));
  }
  const counts = g.loot.map((l) => l.count);
  g.arriveHome();
  assert.deepEqual(g.stock, {
    food: 12,
    water: 12,
    medicine: 4,
    radio: 0,
    tools: 0,
  });
  assert.equal(g.usedSlots, 0);
  assert.equal(g.completedTrips, 1);
  g.arriveHome();
  assert.equal(g.stock.medicine, 4);
  for (const yes of [true, false, true]) g.chooseFamily(yes);
  g.startTrip();
  assert.equal(g.remaining, 60);
  assert.deepEqual({ x: g.player.x, y: g.player.y }, HOME);
  assert.equal(g.usedSlots, 0);
  assert.deepEqual(
    g.loot.map((l) => l.count),
    counts,
  );
  g.update(1);
  assert.equal(g.phase, "expedition");
  assert.ok(g.remaining < 60);
  assert.ok(g.walkTo(17, 8));
  g.update(3);
  assert.ok(g.remaining < 57);
  assert.equal(g.phase, "expedition");
});

test("full physical trip: walk to shelves, pick 4 slots, return through exit, choose family once", () => {
  const g = new Game(8);
  g.startTrip();
  collect(g, 7);
  collect(g, 8);
  collect(g, 4);
  assert.equal(g.usedSlots, 4);
  g.walkTo(HOME.x, HOME.y);
  stepUntil(g, () => g.phase === "family");
  assert.equal(g.stock.food, 12);
  assert.equal(g.stock.water, 12);
  assert.equal(g.stock.radio, 1);
  assert.equal(g.usedSlots, 0);
  assert.ok(g.remaining > 0);
  for (const yes of [true, false, true]) g.chooseFamily(yes);
  assert.equal(g.phase, "shelter");
  assert.deepEqual(
    g.people.map((p) => p.id),
    ["you", "jiwoo", "eun"],
  );
  assert.equal(g.familyDecisions.length, 3);
  g.startTrip();
  g.walkTo(17, 8);
  g.update(4);
  g.walkTo(HOME.x, HOME.y);
  stepUntil(g, () => g.phase === "shelter");
  assert.equal(g.familyDecisions.length, 3);
});

test("round trips count outbound and inbound travel in the same 60 seconds", () => {
  const g = homeGame();
  g.startTrip();
  g.walkTo(15, 6);
  g.update(5);
  const afterOutbound = g.remaining;
  assert.ok(afterOutbound < 56 && afterOutbound > 54);
  assert.equal(g.phase, "expedition");
  g.walkTo(HOME.x, HOME.y);
  stepUntil(g, () => g.phase === "shelter");
  assert.ok(g.remaining < afterOutbound);
  assert.ok(g.completedTrips === 2);
});

test("timeout includes long background-tab frames, and is fatal even next to home", () => {
  const g = new Game(10);
  g.startTrip();
  g.player = { x: 27, y: 8, path: [] };
  g.zombie = { x: 1, y: 1, path: [] };
  g.remaining = 0.1;
  g.update(0.2);
  assert.equal(g.phase, "end");
  assert.equal(g.ending.won, false);
  assert.equal(g.ending.title, "시간 초과");
  const h = new Game(11);
  h.startTrip();
  h.update(120);
  assert.equal(h.phase, "end");
  assert.equal(h.ending.won, false);
});

test("zombie really follows path and catches an idle player, not just a static threat marker", () => {
  const g = new Game(4);
  g.startTrip();
  g.update(30);
  assert.equal(g.phase, "end");
  assert.equal(g.ending.title, "붙잡혔다");
  assert.ok(g.zombie.x > 1 || g.zombie.y > 1);
});

test("all generated paths use adjacent walkable tiles; unreachable shelf clicks cannot walk through walls", () => {
  for (const goal of [...new Game(1).loot, HOME]) {
    const path = findPath({ x: 4, y: 8 }, goal);
    assert.ok(path.length);
    for (let i = 0; i < path.length; i++) {
      assert.equal(blocked(path[i].x, path[i].y), false);
      if (i)
        assert.equal(
          Math.abs(path[i].x - path[i - 1].x) +
            Math.abs(path[i].y - path[i - 1].y),
          1,
        );
    }
  }
  assert.deepEqual(findPath({ x: 4, y: 8 }, { x: 4, y: 4 }), []);
});

test("each rescued family member adds exactly one food and water ration per day", () => {
  for (const family of [
    [false, false, false],
    [true, false, false],
    [true, true, false],
    [true, true, true],
  ]) {
    const g = homeGame(family);
    const n = g.living().length;
    g.stock.food = 20;
    g.stock.water = 20;
    g.advanceDay(feed(g));
    assert.equal(g.stock.food, 20 - n);
    assert.equal(g.stock.water, 20 - n);
    assert.equal(g.day, 2);
  }
});

test("individual ration choices, shortage, hunger, thirst, death, and dose-based treatment", () => {
  const g = homeGame([true, true, true]);
  g.stock.food = 1;
  g.stock.water = 1;
  g.advanceDay(feed(g));
  assert.equal(g.stock.food, 0);
  assert.equal(g.people[0].thirst, 0);
  assert.equal(g.people[1].thirst, 1);
  if (g.phase === "event")
    g.chooseEvent(g.getEvent().options.find((o) => o.enabled).id);
  g.advanceDay({});
  if (g.phase === "event")
    g.chooseEvent(g.getEvent().options.find((o) => o.enabled).id);
  assert.ok(g.people[1].health < 5);
  assert.ok(g.stock.food >= 0 && g.stock.water >= 0);
  const h = homeGame([true, false, false]);
  const p = h.people[0];
  p.health = 2;
  p.injured = true;
  h.stock.medicine = 4;
  assert.ok(h.heal("you"));
  assert.equal(p.health, 5);
  assert.equal(p.injured, false);
  assert.equal(h.stock.medicine, 3);
  assert.equal(h.heal("you"), false);
  assert.equal(h.stock.medicine, 3);
  const k = homeGame([false, false, false]);
  k.people[0].health = 1;
  k.people[0].injured = true;
  k.advanceDay(feed(k));
  assert.equal(k.ending.won, false);
});

test("family abilities genuinely change available event actions; disabled actions cannot spend negative stock", () => {
  const g = homeGame();
  const h = homeGame([false, false, false]);
  for (const [id, choice] of [
    ["raid", "defend"],
    ["injury", "nurse"],
    ["quietNoise", "watch"],
  ]) {
    for (const [instance, expected] of [
      [g, true],
      [h, false],
    ]) {
      instance.event = { id };
      instance.phase = "event";
      assert.equal(
        instance.getEvent().options.find((o) => o.id === choice).enabled,
        expected,
      );
    }
  }
  h.event = { id: "raid" };
  h.phase = "event";
  assert.equal(h.chooseEvent("barricade"), false);
  assert.equal(h.stock.tools, 0);
  g.event = { id: "communityTask" };
  g.phase = "event";
  g.routes.community = "invited";
  assert.ok(g.chooseEvent("repair"));
  assert.equal(g.stock.tools, 0);
  assert.equal(g.routes.community, "trusted");
});

test("quiet streak never exceeds two days, including when no scheduled event is eligible", () => {
  for (let seed = 0; seed < 150; seed++) {
    const g = homeGame([], seed);
    g.queue = [];
    let quiet = 0;
    for (let day = 2; day <= 40; day++) {
      g.day = day;
      g.nextEvent();
      if (g.phase === "event") {
        quiet = 0;
        g.chooseEvent("rest");
      } else quiet++;
      assert.ok(quiet <= MAX_QUIET_DAYS);
      assert.equal(g.quietDays, quiet);
    }
  }
});

test("random seed changes schedules; sequential stages only open after the previous choice", () => {
  const a = new Game(1),
    b = new Game(2),
    c = new Game(1);
  assert.notDeepEqual(a.queue, b.queue);
  assert.deepEqual(a.queue, c.queue);
  assert.equal(
    a.queue.some((e) => e.id === "rescueBrief"),
    false,
  );
  assert.equal(
    a.queue.some((e) => e.id === "rescuePickup"),
    false,
  );
  a.phase = "event";
  a.event = { id: "radio" };
  a.stock.radio = 1;
  a.chooseEvent("answer");
  assert.ok(a.queue.some((e) => e.id === "rescueBrief" && e.due > a.day));
  assert.equal(
    a.queue.some((e) => e.id === "rescuePickup"),
    false,
  );
});

test("both victory routes finish through actual event scheduling across 100 random campaigns each", () => {
  for (const target of ["rescue", "community"])
    for (let seed = 1; seed <= 100; seed++) {
      const g = homeGame([true, true, true], seed);
      g.stock = { food: 1000, water: 1000, medicine: 10, radio: 1, tools: 0 };
      let quiet = 0;
      for (let i = 0; i < 35 && g.phase !== "end"; i++) {
        g.advanceDay(feed(g));
        if (g.phase === "event") {
          quiet = 0;
          resolveSafely(g, target);
        } else quiet++;
        assert.ok(quiet <= MAX_QUIET_DAYS);
      }
      assert.equal(
        g.ending?.won,
        true,
        `${target} seed ${seed} has no ending by day ${g.day}`,
      );
      assert.equal(g.ending.route, target);
      const ids = g.history.map((e) => e.id),
        stages =
          target === "rescue"
            ? ["radio", "rescueBrief", "rescuePickup"]
            : ["community", "communityTask", "communityJoin"];
      assert.ok(ids.indexOf(stages[0]) < ids.indexOf(stages[1]));
      assert.ok(ids.indexOf(stages[1]) < ids.indexOf(stages[2]));
      for (let i = 1; i < stages.length; i++) {
        const previous = g.history.find((e) => e.id === stages[i - 1]),
          next = g.history.find((e) => e.id === stages[i]);
        assert.ok(next.day > previous.day);
        assert.ok(
          next.day - previous.day <= 7,
          "follow-up must have a bounded wait even with competing events",
        );
      }
    }
});

test("unmet victory requirements can be deferred, then completed; waiting alone never wins", () => {
  const g = homeGame();
  g.routes.rescue = "contacted";
  g.stock.radio = 1;
  g.stock.food = 0;
  g.stock.water = 0;
  g.event = { id: "rescueBrief" };
  g.phase = "event";
  assert.equal(g.chooseEvent("prepare"), false);
  assert.equal(g.routes.rescue, "contacted");
  assert.ok(g.chooseEvent("wait"));
  assert.ok(g.queue.some((e) => e.id === "rescueBrief"));
  g.stock.food = 8;
  g.stock.water = 8;
  g.queue = [];
  for (let i = 0; i < 50; i++) {
    g.day++;
    g.nextEvent();
    if (g.phase === "event") g.chooseEvent("rest");
  }
  assert.equal(g.ending, null);
  g.event = { id: "rescueBrief" };
  g.phase = "event";
  g.chooseEvent("prepare");
  assert.equal(g.stock.food, 4);
  assert.equal(g.stock.water, 4);
  assert.ok(g.queue.some((e) => e.id === "rescuePickup"));
});

test("new game resets finite loot, family choices, paths, days, and ending", () => {
  const g = homeGame();
  g.stock.food = 0;
  g.win("community", "done", "done");
  const fresh = new Game(900);
  assert.equal(fresh.phase, "intro");
  assert.equal(fresh.day, 1);
  assert.equal(fresh.people.length, 1);
  assert.equal(fresh.familyDecisions.length, 0);
  assert.equal(fresh.ending, null);
  assert.equal(fresh.loot[0].count, 3);
  assert.equal(fresh.trip, 0);
});
