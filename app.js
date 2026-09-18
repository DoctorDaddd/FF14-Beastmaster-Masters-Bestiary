(function () {
  'use strict';
  const C = window.BestiaryCore;
  const data = window.BESTIARY_DATA;
  const beasts = data.beasts;
  const byId = new Map(beasts.map(b => [b.id, b]));
  const KEY = 'ff14.bestiary.progress.v1';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let storage;
  try { storage = window.localStorage; } catch (_) { storage = { getItem() { throw new Error('无法访问本地存储'); }, setItem() { throw new Error('无法访问本地存储'); } }; }
  const loaded = C.load(storage, KEY, beasts);
  let state = loaded.state;
  let options = { query: '', region: '', sort: 'id', status: 'all' };
  let detailId = null;
  let visibleRows = [];

  function storageWarning(message) {
    $('storage-warning').textContent = message;
    $('storage-warning').hidden = false;
    $('save-status').textContent = '● 自动保存失败';
    $('save-status').classList.add('failed');
  }
  function persist() {
    const result = C.save(storage, KEY, state);
    if (!result.saved) storageWarning('浏览器未能保存进度。当前操作仅保留在本页面中，关闭或刷新后可能丢失。');
    else {
      $('storage-warning').hidden = true;
      $('save-status').textContent = '● 进度已保存到本机';
      $('save-status').classList.remove('failed');
    }
    return result.saved;
  }
  function coords(location) {
    return C.hasCoordinates(location) ? `X: ${location.x}   Y: ${location.y}` : '';
  }
  function levelText(beast) { return beast.levelText && beast.levelText !== '-' ? beast.levelText.replace(/~/g, '～') : '—'; }
  function portrait(beast) {
    const image = typeof beast.image === 'string' && /^assets\/[a-zA-Z0-9_.-]+$/.test(beast.image) ? beast.image : null;
    return `<div class="portrait">${image ? `<img src="${esc(image)}" alt="${esc(beast.name)}" loading="lazy" decoding="async">` : ''}<div class="missing-image" ${image ? 'hidden' : ''}><span class="missing-symbol" aria-hidden="true">◇</span><span>暂无图片</span></div><span class="card-number">No. ${String(beast.id).padStart(3, '0')}</span></div>`;
  }
  function locationLabel(beast, location) {
    return location?.map ? location.map + (location.note ? ` · ${location.note}` : '') : beast.acquisitionLabel || '位置待补充';
  }
  function card(row) {
    const { beast, location, completed } = row;
    let art = portrait(beast);
    const badges = `${completed ? '<span class="captured-seal" aria-label="已捕获">✓</span>' : ''}`;
    art = art.replace('<span class="card-number">', badges + '<span class="card-number">');
    const acquisition = location?.kind === 'dungeon' ? '副本获取' : beast.acquisitionLabel || '';
    return `<article class="beast-card ${completed ? 'is-completed' : ''}" data-beast-id="${beast.id}"><button class="card-main" data-detail="${beast.id}" aria-label="查看${esc(beast.name)}详情">${art}<div class="card-info"><div class="name-row"><h2>${esc(beast.name)}</h2><span class="level"><small>Lv.</small>${esc(levelText(beast))}</span></div><div class="card-region">${esc(locationLabel(beast, location))}</div><div class="card-coords">${esc(coords(location) || (location?.kind === 'dungeon' ? '副本内无固定野外坐标' : ''))}</div><div class="card-acquisition">${esc(acquisition)}</div></div></button><label class="card-check"><input type="checkbox" data-captured="${beast.id}" aria-label="${esc(beast.name)}已捕获" ${completed ? 'checked' : ''}><span class="check-label">已捕获</span><span class="check-status">${completed ? '已记录' : '点击记录'}</span></label></article>`;
  }
  function render() {
    visibleRows = C.view(beasts, state, options);
    const completed = state.completed.length;
    const percentage = beasts.length ? Math.round(completed / beasts.length * 100) : 0;
    $('done-count').textContent = completed;
    $('total-count').textContent = beasts.length;
    $('all-count').textContent = beasts.length;
    $('completed-count').textContent = completed;
    $('remaining-count').textContent = beasts.length - completed;
    $('percentage').textContent = percentage + '%';
    $('progress').value = completed;
    $('progress').max = beasts.length || 1;
    $('progress').setAttribute('aria-valuetext', `已捕获 ${completed}，共 ${beasts.length} 种`);
    const modeText = options.status === 'remaining' ? '尚未捕获' : options.status === 'completed' ? '已经捕获' : '全部魔兽';
    $('result-count').textContent = `${modeText} · ${visibleRows.length} 种`;
    const hints = { id: '依图鉴编号排列', 'level-asc': '等级升序 → 地区', 'level-desc': '等级降序 → 地区', region: '地区 → 等级升序' };
    $('sort-hint').textContent = hints[options.sort];
    document.querySelectorAll('[data-status]').forEach(button => {
      const active = button.dataset.status === options.status;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const hideCaptured = options.status === 'remaining';
    $('hide-captured').setAttribute('aria-pressed', String(hideCaptured));
    $('hide-captured').classList.toggle('active', hideCaptured);
    const regions = C.regionProgress(beasts, state.completed);
    Array.from($('region').options).forEach(option => {
      const progress = regions.get(option.value);
      if (!progress) return;
      const complete = progress.total > 0 && progress.completed === progress.total;
      option.textContent = option.value + (complete ? ' ✅' : '');
      option.title = `已捕获 ${progress.completed} / ${progress.total}`;
    });
    $('grid').innerHTML = visibleRows.map(card).join('');
    $('grid').hidden = visibleRows.length === 0;
    $('empty').hidden = visibleRows.length > 0;
    if (!beasts.length) {
      $('empty-title').textContent = '图鉴资料尚未载入';
      $('empty-description').textContent = '需要核对完整的 Wiki 页面后，才能填入魔兽清单。';
      $('reset-filters').hidden = true;
    } else {
      $('empty-title').textContent = '没有找到魔兽';
      $('empty-description').textContent = '试试其他名称，或清除筛选条件。';
      $('reset-filters').hidden = false;
    }
  }
  function updateCaptured(ids, captured) {
    if (!Array.isArray(ids) || ids.some(id => !byId.has(id)) || typeof captured !== 'boolean') throw new Error('无效的捕获操作。');
    const completed = new Set(state.completed);
    ids.forEach(id => captured ? completed.add(id) : completed.delete(id));
    state = { ...state, completed: [...completed].sort((a, b) => a - b) };
    const saved = persist();
    render();
    return saved;
  }
  function mapFigure(beast, map, floorIndex = 0) {
    const floor = data.maps?.[map]?.floors?.[floorIndex];
    if (!floor || !/^assets\/map-\d+\.webp$/.test(floor.image)) return '<p class="map-note">暂无可用的离线地图。</p>';
    const points = beast.locations.map((p, i) => ({ p, i })).filter(({ p }) => p.map === map && C.hasCoordinates(p));
    const entrances = (beast.entrances || []).filter(p => p.map === map && C.hasCoordinates(p));
    const labels = (floor.labels || []).filter(label => label.type === 9 || label.type === 3).map(label => `<text class="map-place-label" x="${label.x}" y="${label.y}">${esc(label.text)}</text>`).join('');
    const rings = points.map(({ p, i }) => {
      const point = C.mapPoint(p, floor.scale);
      if (!point) return '';
      return `<g class="map-marker" data-location-index="${i}"><title>位置 ${i + 1}：${esc(coords(p))}${point.radius ? `，Wiki 范围半径 ${p.radius}` : ''}</title><circle class="map-ring ${point.radius ? 'area-ring' : 'point-ring'}" cx="${point.x}" cy="${point.y}" r="${point.radius || 36}"/><circle class="map-center" cx="${point.x}" cy="${point.y}" r="9"/><text class="map-marker-number" x="${point.x + 24}" y="${point.y - 28}">${i + 1}</text></g>`;
    }).join('');
    const entranceMarkers = entrances.map(p => {
      const point = C.mapPoint(p, floor.scale);
      if (!point) return '';
      return `<g class="map-entrance"><title>${esc(p.label || '入口')}：${esc(coords(p))}</title><path class="entrance-diamond" d="M ${point.x} ${point.y - 28} l 28 28 -28 28 -28 -28 Z"/><text class="entrance-label" x="${point.x + 42}" y="${point.y + 18}">入口</text></g>`;
    }).join('');
    return `<figure class="habitat-figure"><div class="map-canvas"><img class="habitat-map-image" src="${esc(floor.image)}" alt="${esc(map)} · ${esc(floor.name)}地图" decoding="async"><svg class="map-overlay" viewBox="0 0 2048 2048" role="img" aria-label="${points.length ? `红圈标注 ${points.length} 个栖息位置，编号与坐标列表对应${entrances.length ? `；另有 ${entrances.length} 个入口标记` : ''}` : '来源未提供捕获坐标，地图没有标注红圈'}">${labels}${rings}${entranceMarkers}</svg><p class="map-load-error" hidden>地图未能载入，请检查配套图片文件是否完整。</p></div><figcaption>${entrances.length ? '红圈为地下栖息位置，金色菱形为地下入口。' : ''}${points.length ? '红圈对应上方位置编号；虚线范围依据 Wiki，实线小圈表示坐标点。' : (data.maps[map].kind === 'dungeon' ? '副本楼层地图 · Wiki 未提供此魔兽的捕获坐标，未标注红圈。' : 'Wiki 未提供具体坐标，当前地图未标注红圈。')}</figcaption></figure>`;
  }
  function habitatMaps(beast) {
    return [...new Set(beast.locations.map(p => p.map).filter(Boolean))].map(map => {
      const entry = data.maps?.[map];
      if (!entry?.floors?.length) return `<section class="habitat-panel"><p class="map-note">${esc(map)}：暂无可用的离线地图。</p></section>`;
      return `<section class="habitat-panel" data-habitat-map="${esc(map)}"><div class="habitat-map-heading"><strong>${esc(map)}</strong>${entry.floors.length > 1 ? `<select data-map-floor aria-label="${esc(map)}楼层">${entry.floors.map((f, i) => `<option value="${i}">${esc(f.name)}</option>`).join('')}</select>` : '<span>离线地图</span>'}</div><div class="map-canvas-wrap">${mapFigure(beast, map)}</div></section>`;
    }).join('');
  }
  function showDetail(id) {
    const beast = byId.get(id);
    if (!beast) return;
    detailId = id;
    const completed = state.completed.includes(id);
    const locationItems = beast.locations.map((p, i) => `<div class="location-item"><div><div class="location-map">${C.hasCoordinates(p) ? `<span class="location-index">${i + 1}</span> ` : ''}${esc(locationLabel(beast, p))}</div><div class="location-coords">${esc(coords(p) || (p.kind === 'dungeon' ? '副本获取' : '无地图坐标'))}</div></div></div>`).join('');
    const entranceItems = (beast.entrances || []).filter(C.hasCoordinates).map(p => `<div class="location-item entrance-item"><div><div class="location-map"><span class="entrance-icon" aria-hidden="true">◆</span> ${esc(p.label || '入口')} · ${esc(p.map)}</div><div class="location-coords">${esc(coords(p))}</div></div></div>`).join('');
    let sourceUrl = data.sourceUrl;
    try { if (new URL(beast.sourceUrl).protocol === 'https:') sourceUrl = beast.sourceUrl; } catch (_) {}
    $('detail-content').innerHTML = `<div class="detail-hero">${portrait(beast)}<div class="detail-heading"><span class="detail-number">No. ${String(id).padStart(3, '0')}</span><h2 id="detail-title">${esc(beast.name)}</h2><span class="detail-level">等级 ${esc(levelText(beast))}</span><label class="detail-capture"><input type="checkbox" data-captured="${id}" aria-label="${esc(beast.name)}已捕获" ${completed ? 'checked' : ''}>已捕获</label></div></div><div class="detail-body"><h3>栖息地与位置</h3><div class="location-list">${(locationItems + entranceItems) || '<p class="muted">初始自带，无需前往地图捕获。</p>'}</div>${habitatMaps(beast)}<h3>获取说明</h3><p class="acquisition">${esc(beast.acquisition || '在标记位置寻找对应魔兽，使用“识破”确认捕获条件，再使用“捕获”。')}</p><div class="detail-source"><span>资料：灰机 Wiki${beast.userCorrection ? ' · 名称、等级与位置由用户补充' : ''}</span><a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">查看原始条目 ↗</a></div></div>`;
    if (!$('detail-dialog').open) $('detail-dialog').showModal();
  }
  $('search').addEventListener('input', event => { options.query = event.target.value; render(); });
  $('region').addEventListener('change', event => { options.region = event.target.value; render(); });
  $('sort').addEventListener('change', event => { options.sort = event.target.value; render(); });
  document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => { options.status = button.dataset.status; render(); }));
  $('hide-captured').addEventListener('click', () => { options.status = options.status === 'remaining' ? 'all' : 'remaining'; render(); });
  $('reset-filters').addEventListener('click', () => { options = { ...options, query: '', region: '', status: 'all' }; $('search').value = ''; $('region').value = ''; render(); });
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-close]');
    if (close) $(close.dataset.close).close();
    const detail = event.target.closest('[data-detail]');
    if (detail) showDetail(Number(detail.dataset.detail));
  });
  document.addEventListener('change', event => {
    if (event.target.matches('[data-map-floor]')) {
      const panel = event.target.closest('[data-habitat-map]');
      panel.querySelector('.map-canvas-wrap').innerHTML = mapFigure(byId.get(detailId), panel.dataset.habitatMap, Number(event.target.value));
      return;
    }
    const checkbox = event.target.closest('[data-captured]');
    if (!checkbox) return;
    const id = Number(checkbox.dataset.captured);
    const captured = checkbox.checked;
    const wasDetail = !!checkbox.closest('#detail-dialog');
    const hadFocus = document.activeElement === checkbox;
    updateCaptured([id], captured);
    if (wasDetail) showDetail(id);
    if (hadFocus) {
      const target = wasDetail ? $('detail-content').querySelector('[data-captured]') : $('grid').querySelector(`[data-captured="${id}"]`);
      if (target) target.focus({ preventScroll: true });
      else $('result-count').focus({ preventScroll: true });
    }
  });
  document.addEventListener('error', event => {
    if (event.target instanceof HTMLImageElement && event.target.classList.contains('habitat-map-image')) {
      const canvas = event.target.closest('.map-canvas');
      event.target.hidden = true;
      canvas.querySelector('.map-overlay').setAttribute('hidden', '');
      canvas.querySelector('.map-load-error').hidden = false;
    }
    if (event.target instanceof HTMLImageElement && event.target.closest('.portrait')) {
      event.target.hidden = true;
      event.target.parentElement.querySelector('.missing-image').hidden = false;
    }
  }, true);
  $('help').addEventListener('click', () => $('help-dialog').showModal());
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }));
  const maps = [...new Set(beasts.flatMap(b => b.locations.map(p => p.map).filter(Boolean)))].sort(new Intl.Collator('zh-CN').compare);
  maps.forEach(map => { const option = document.createElement('option'); option.value = map; option.textContent = map; $('region').appendChild(option); });
  $('help-source').textContent = data.verified ? `资料核对日期：${data.capturedAt}。收录来源页面的 ${beasts.length} 个图鉴条目。资料和图片随网页离线保存，外部来源链接需要联网打开。` : '完整 Wiki 资料尚待核对，当前不将检索摘要作为完整图鉴。';
  if (!data.verified) { $('data-warning').textContent = '完整图鉴资料尚待核对，此页面尚未完成交付。'; $('data-warning').hidden = false; }
  if (loaded.error) storageWarning('无法读取本地进度，可能是浏览器存储受限或存档损坏。当前显示空进度。');
  $('result-count').tabIndex = -1;
  render();

  // Optional browser integration. All mutations share the visible UI's state path.
  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    const tools = [
      { name: 'get_bestiary_view', description: '读取当前筛选和排序后的魔兽列表、捕获状态。', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute() { return { completed: state.completed.length, total: beasts.length, visible: visibleRows.map(r => ({ id: r.beast.id, name: r.beast.name, captured: r.completed, level: r.beast.levelText, location: r.location })) }; } },
      { name: 'set_beasts_captured', description: '将指定魔兽批量标为已捕获或未捕获，并保存本机进度。', inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer' } }, captured: { type: 'boolean' } }, required: ['ids', 'captured'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute(input) { if (!input || !Array.isArray(input.ids) || typeof input.captured !== 'boolean') throw new Error('需要魔兽编号数组及捕获状态。'); const saved = updateCaptured(input.ids, input.captured); return { completed: state.completed.length, saved }; } }
    ];
    tools.forEach(tool => { try { Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch (_) {} });
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
