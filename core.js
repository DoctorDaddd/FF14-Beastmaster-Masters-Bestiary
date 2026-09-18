(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BestiaryCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'ff14-local-bestiary';
  const VERSION = 1;
  const collator = new Intl.Collator('zh-CN', { numeric: true });
  const hasCoordinates = p => !!p && typeof p.map === 'string' && p.map.length > 0 && Number.isFinite(p.x) && Number.isFinite(p.y);
  const emptyState = () => ({ completed: [] });

  function compareNullable(a, b, descending = false) {
    const aa = Number.isFinite(a), bb = Number.isFinite(b);
    if (!aa || !bb) return aa ? -1 : bb ? 1 : 0;
    return descending ? b - a : a - b;
  }
  function compareRegion(a, b) {
    const ma = a?.map || '', mb = b?.map || '';
    if (!ma || !mb) return ma ? -1 : mb ? 1 : 0;
    return collator.compare(ma, mb);
  }
  function view(beasts, state, options = {}) {
    const query = (options.query || '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
    const completed = new Set(state.completed);
    const sort = options.sort || 'id';
    const region = options.region || '';
    return beasts.filter(b => {
      if (query && !b.name.normalize('NFKC').toLocaleLowerCase('zh-CN').includes(query)) return false;
      if (region && !b.locations.some(p => p.map === region)) return false;
      if (options.status === 'completed' && !completed.has(b.id)) return false;
      if (options.status === 'remaining' && completed.has(b.id)) return false;
      return true;
    }).map(beast => {
      const location = (region ? beast.locations.find(p => p.map === region) : beast.locations[0]) || null;
      return { beast, location, completed: completed.has(beast.id) };
    }).sort((a, b) => {
      if (sort === 'id') return a.beast.id - b.beast.id;
      const byRegion = compareRegion(a.location, b.location);
      const byLevel = compareNullable(a.beast.levelMin, b.beast.levelMin, sort === 'level-desc');
      return (sort === 'region' ? byRegion || byLevel : byLevel || byRegion) || a.beast.id - b.beast.id;
    });
  }
  function validateState(input, beasts) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('本地进度格式无效。');
    if (input.format !== FORMAT || input.version !== VERSION) throw new Error('本地进度格式或版本不受支持。');
    const ids = new Set(beasts.map(b => b.id));
    if (!Array.isArray(input.completed) || input.completed.some(id => !Number.isSafeInteger(id) || !ids.has(id))) throw new Error('本地进度包含无效或不属于当前图鉴的魔兽编号。');
    if (new Set(input.completed).size !== input.completed.length) throw new Error('本地进度包含重复的魔兽编号。');
    return { completed: [...input.completed].sort((a, b) => a - b) };
  }
  function load(storage, key, beasts) {
    try {
      const raw = storage.getItem(key);
      return { state: raw ? validateState(JSON.parse(raw), beasts) : emptyState(), error: null };
    } catch (error) { return { state: emptyState(), error }; }
  }
  function save(storage, key, state) {
    try { storage.setItem(key, JSON.stringify({ format: FORMAT, version: VERSION, completed: [...state.completed].sort((a, b) => a - b) })); return { saved: true }; }
    catch (error) { return { saved: false, error }; }
  }
  function regionProgress(beasts, completed) {
    const captured = new Set(completed);
    const result = new Map();
    beasts.forEach(beast => {
      new Set(beast.locations.map(p => p.map).filter(Boolean)).forEach(map => {
        const count = result.get(map) || { total: 0, completed: 0 };
        count.total++;
        if (captured.has(beast.id)) count.completed++;
        result.set(map, count);
      });
    });
    return result;
  }
  function mapPoint(location, scale) {
    if (!hasCoordinates(location) || !Number.isFinite(scale) || scale <= 0) return null;
    // Wiki EorzeaMap uses a 2048px canvas, with cellLength = scale / 2.
    return { x: (location.x - 1) * scale / 2, y: (location.y - 1) * scale / 2,
      radius: Number.isFinite(location.radius) && location.radius > 0 ? location.radius * scale / 2 : null };
  }
  return { FORMAT, VERSION, hasCoordinates, emptyState, compareNullable, view, validateState, load, save, regionProgress, mapPoint };
});
