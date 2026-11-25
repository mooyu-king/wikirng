'use strict';

const byId = (id) => document.getElementById(id);
const dayKeyPrefix = 'curiodraw-draw-v2:';
const oldDayKeyPrefix = 'curiodraw-preview-v1:';
const dayLength = 86_400_000;
const previewRecords = new Map();
const dateLabel = new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', timeZone: 'UTC' });
const cardDate = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' });
const cardTimestamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });
const summarySentences = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'sentence' }) : null;
const numberLabel = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
const counts = new Map(Object.keys(badgeLabels).map((badge) => [badge, 0]));

for (const article of articles) {
  for (const badge of article.badges) counts.set(badge, counts.get(badge) + 1);
}

const legacyCatalog = drawRules.addRanks(articles.map((article) => {
  const reasons = article.badges.map((badge) => {
    const hits = counts.get(badge);
    const odds = (hits + 1) / (articles.length + 2);
    return { badge, label: badgeLabels[badge], hits, points: Math.min(120, Math.round(20 * -Math.log2(odds))) };
  }).sort((a, b) => b.points - a.points);
  return { ...article, reasons, score: 100 + reasons.reduce((total, entry) => total + entry.points, 0), poolSize: articles.length, edition: 'first-preview' };
}));

const legacyEntries = new Map(legacyCatalog.map((article) => [article.slug, article]));
const ratedEdition = drawRules.buildRarityPool(drawRules.buildEdition(articleEdition), wikipediaViews);
const catalog = ratedEdition.articles;
const ratedCards = catalog.filter((article) => article.tierId);
const tierNames = new Map(drawRules.tiers.map((tier) => [tier.id, tier.name]));
const editionById = new Map(catalog.map((article) => [article.id, article]));
const editionByTitle = new Map(catalog.map((article) => [article.title, article]));
const screens = ['daily', 'journal', 'pool', 'guide'];
const fallbackNotice = 'Browser storage is unavailable. This draw stays visible while this page is open.';
const pageSize = 12;
const collectionPageSize = 18;
const badgeExplanations = {
  mapped: 'The article has map coordinates',
  concise: 'The article is 24,000 bytes or shorter',
  extensive: 'The article is at least 115,000 bytes',
  notation: 'The title ends in parentheses',
  numeric: 'The title contains a number',
  long: 'The title has at least five words'
};
let resolvedDay = '';
let revealed = null;
let activeView = 'daily';
let busy = false;
let poolPage = 0;
let quizDay = '';
let collectionPage = 0;
let collectionStatus = 'all';

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function decodeRecord(value) {
  try {
    const article = JSON.parse(value);
    if (article?.sourceType !== 'wikipedia-excerpt' || !/^\d+$/.test(article.id) ||
        !Number.isSafeInteger(article.revision) || article.revision < 1 ||
        typeof article.title !== 'string' || typeof article.topic !== 'string' ||
        typeof article.summary !== 'string' || typeof article.edition !== 'string' ||
        !Number.isSafeInteger(article.rank) || !Number.isSafeInteger(article.poolSize) ||
        article.rank < 1 || article.rank > article.poolSize ||
        !Array.isArray(article.badges) || !Array.isArray(article.reasons) ||
        !article.reasons.every((reason) => reason && typeof reason.label === 'string' &&
          Number.isInteger(reason.hits) && reason.hits >= 1 && reason.hits <= article.poolSize &&
          Number.isInteger(reason.points) && reason.points >= 0 && reason.points <= 120) ||
        article.score !== 100 + article.reasons.reduce((sum, reason) => sum + reason.points, 0)) return null;
    return article;
  } catch {
    return null;
  }
}

function storedResult(day) {
  try {
    const saved = decodeRecord(localStorage.getItem(dayKeyPrefix + day))
      ?? legacyEntries.get(localStorage.getItem(oldDayKeyPrefix + day));
    if (saved) return { article: saved, stored: true };
  } catch {
    // Records in this session remain visible if the browser rejects storage.
  }
  const article = previewRecords.get(day);
  return article ? { article, stored: false } : null;
}

function saveDaily(day, drawnAt, quizAnswer) {
  const existing = storedResult(day);
  if (existing) return { ...existing, fresh: false };
  const article = { ...drawRules.drawByRarity(ratedEdition.bins, quizAnswer.correct), drawnAt, quizAnswer };
  previewRecords.set(day, article);
  try {
    localStorage.setItem(dayKeyPrefix + day, JSON.stringify(article));
    return { article, stored: true, fresh: true };
  } catch {
    return { article, stored: false, fresh: true };
  }
}

function allRecords() {
  const records = new Map(previewRecords);
  try {
    const dates = new Set();
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const prefix = [dayKeyPrefix, oldDayKeyPrefix].find((candidate) => key?.startsWith(candidate));
      if (prefix) dates.add(key.slice(prefix.length));
    }
    for (const day of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > dayKey()) continue;
      const record = storedResult(day);
      if (record) records.set(day, record.article);
    }
  } catch {
    // The in-memory entries still provide a journal during this visit.
  }
  return [...records].sort(([left], [right]) => right.localeCompare(left));
}

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value) node.textContent = value;
  return node;
}

function sourceFor(article) {
  return article.id ? 'https://en.wikipedia.org/?curid=' + article.id : 'https://en.wikipedia.org/wiki/' + article.slug;
}

function editionLabel(article) {
  return article.edition === 'first-preview' ? 'First preview' : article.edition;
}

function articleLink(article) {
  const link = element('a', null, 'Read on Wikipedia');
  link.href = sourceFor(article);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function rarityName(article) {
  return tierNames.get(article.tierId) ?? 'Unrated';
}

function writeRarity(target, article, label = rarityName(article)) {
  target.classList.add('rarity-label');
  target.replaceChildren();
  if (tierNames.has(article.tierId)) {
    const icon = byId('odds-buttons').querySelector('[data-tier="' + article.tierId + '"] .rarity-icon');
    if (icon) target.append(icon.cloneNode(true));
  }
  target.append(label);
}

function viewLabel(article) {
  return Number.isInteger(article.views) && typeof article.viewMonth === 'string'
    ? numberLabel.format(article.views) + ' views · ' + article.viewMonth
    : 'Unavailable';
}

function showOdds(tierId) {
  const bin = ratedEdition.bins.find(({ id }) => id === tierId);
  for (const button of byId('odds-buttons').querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.tier === tierId));
  }
  const first = bin.entries[0];
  const last = bin.entries[bin.entries.length - 1];
  const range = first.views === last.views ? numberLabel.format(first.views)
    : numberLabel.format(first.views) + '–' + numberLabel.format(last.views);
  byId('odds-detail').textContent = bin.name + ' · ' + bin.entries.length +
    (bin.entries.length === 1 ? ' article' : ' articles') + ' · ' + range +
    ' pageviews · ' + wikipediaViews.month + ' · Correct: ' + drawRules.formatOdds(bin, true) +
    ' · Incorrect: ' + drawRules.formatOdds(bin, false);
}

function writeCardDate(prefix, drawnAt, day) {
  const saved = typeof drawnAt === 'string' ? new Date(drawnAt) : null;
  const hasTime = saved && Number.isFinite(saved.getTime()) && dayKey(saved) === day;
  const time = byId(prefix + '-date');
  time.dateTime = hasTime ? saved.toISOString() : day;
  byId(prefix + '-date-label').textContent = hasTime ? 'Drawn' : 'Draw date';
  time.textContent = (hasTime ? cardTimestamp.format(saved) : cardDate.format(new Date(day + 'T00:00:00Z'))) + ' UTC';
}

function showCollectionCard({ article, number, unlocked, drawnAt }) {
  const dialog = byId('collection-dialog');
  const stage = byId('collection-unlocked');
  const isUnlocked = Boolean(unlocked);
  const source = byId('collection-source');
  dialog.classList.toggle('is-unlocked', isUnlocked);
  stage.hidden = !isUnlocked;
  byId('collection-locked').hidden = isUnlocked;
  dialog.setAttribute('aria-labelledby', isUnlocked ? 'collection-title' : 'collection-locked-title');
  articleMedia.clear(stage);
  if (isUnlocked) {
    byId('collection-title').textContent = article.title;
    byId('collection-description').textContent = conciseSummary(article.summary);
    byId('collection-topic').textContent = article.topic;
    byId('collection-views').textContent = viewLabel(article);
    writeRarity(byId('collection-banner-rarity'), article, rarityName(article) + ' card');
    writeRarity(byId('collection-rarity'), article);
    writeCardDate('collection', drawnAt, unlocked);
    source.href = sourceFor(article);
    byId('collection-credit').hidden = !article.revision;
    if (article.revision) byId('collection-revision').href = 'https://en.wikipedia.org/w/index.php?oldid=' + article.revision;
    stage.querySelector('[data-media-credits]').open = false;
    articleMedia.show(article, stage);
  } else {
    source.removeAttribute('href');
    byId('collection-locked-title').textContent = 'Locked Card #' + number;
    writeRarity(byId('collection-locked-rarity'), article);
  }
  dialog.showModal();
  dialog.scrollTop = 0;
}

function renderJournal() {
  const records = allRecords();
  const unlockedCards = new Map();
  const archive = new Map();
  for (const [day, article] of records) {
    const current = editionById.get(article.id) ?? editionByTitle.get(article.title);
    if (current?.tierId) {
      if (!unlockedCards.has(current.id)) unlockedCards.set(current.id, { unlocked: day, drawnAt: article.drawnAt });
    } else if (!archive.has(article.title)) {
      archive.set(article.title, { article, unlocked: day, drawnAt: article.drawnAt });
    }
  }
  const discoveredBadges = new Set(records.flatMap(([, article]) => article.badges));
  byId('summary-discoveries').textContent = records.length;
  byId('summary-badges').textContent = discoveredBadges.size;
  byId('journal-message').textContent = unlockedCards.size + ' of ' + ratedCards.length + ' current cards unlocked in this browser.';
  byId('collection-progress').textContent = unlockedCards.size + ' unlocked · ' + (ratedCards.length - unlockedCards.size) + ' locked' +
    (archive.size ? ' · ' + archive.size + ' archived' : '');
  const tier = byId('journal-filter').value;
  const roster = ratedCards.map((article, index) => ({ article, number: index + 1, ...unlockedCards.get(article.id) }));
  const ordered = [
    ...roster.filter(({ unlocked }) => unlocked).sort((a, b) => b.unlocked.localeCompare(a.unlocked)),
    ...archive.values(),
    ...roster.filter(({ unlocked }) => !unlocked)
  ];
  const visible = ordered.filter(({ article, unlocked }) =>
    (tier === 'all' || tier === article.tierId) &&
    (collectionStatus === 'all' || Boolean(unlocked) === (collectionStatus === 'unlocked')));
  collectionPage = Math.min(collectionPage, Math.max(0, Math.ceil(visible.length / collectionPageSize) - 1));
  const start = collectionPage * collectionPageSize;
  const end = Math.min(visible.length, start + collectionPageSize);
  const list = byId('journal-list');
  articleMedia.clearCovers();
  list.replaceChildren();
  byId('journal-empty').hidden = visible.length !== 0;
  byId('collection-pager').hidden = visible.length <= collectionPageSize;
  byId('collection-range').textContent = end ? (start + 1) + '–' + end + ' of ' + visible.length : '';
  byId('collection-prev').disabled = start === 0;
  byId('collection-next').disabled = end === visible.length;
  for (const slot of visible.slice(start, end)) {
    const { article, unlocked, number } = slot;
    const card = element('button', 'collection-card' + (unlocked ? ' is-unlocked' : ''));
    card.type = 'button';
    card.dataset.tier = article.tierId ?? 'archive';
    card.addEventListener('click', () => showCollectionCard(slot));
    const cover = element('span', 'collection-cover');
    const state = element('span', 'eyebrow collection-state');
    if (unlocked) {
      const tier = element('span', 'collection-tier');
      writeRarity(tier, article);
      cover.append(tier);
      state.textContent = 'Unlocked';
    } else {
      const back = element('img', 'collection-card-back');
      back.src = 'brand/icon-192.png';
      back.alt = '';
      back.width = 76;
      back.height = 76;
      cover.append(back);
      writeRarity(state, article, rarityName(article) + ' · Locked');
    }
    card.append(
      cover,
      state,
      element('strong', null, unlocked ? article.title : 'Card #' + number)
    );
    list.append(card);
    if (unlocked) {
      const photo = element('img', 'collection-cover-photo');
      photo.alt = '';
      photo.hidden = true;
      photo.referrerPolicy = 'no-referrer';
      cover.prepend(photo);
      articleMedia.cover(photo, article);
    }
  }
}

function renderPool() {
  const topic = byId('pool-filter').value;
  const pool = topic === 'all' ? catalog : catalog.filter((article) => article.topic === topic);
  const start = poolPage * pageSize;
  const end = Math.min(start + pageSize, pool.length);
  const list = byId('pool-list');
  list.replaceChildren();
  for (const article of pool.slice(start, end)) {
    const card = element('article', 'journal-entry');
    card.append(element('p', 'eyebrow', article.topic), element('h2', null, article.title),
      element('p', null, rarityName(article) + ' · ' + viewLabel(article)), articleLink(article));
    list.append(card);
  }
  byId('pool-range').textContent = (start + 1) + '–' + end + ' of ' + pool.length + ' articles';
  byId('pool-prev').disabled = poolPage === 0;
  byId('pool-next').disabled = end === pool.length;
}

function writeReason(container, name, points, frequency) {
  const row = element('li');
  const description = element('span', null, name);
  if (frequency) description.append(element('small', null, frequency));
  row.append(description, element('strong', null, points ? '+' + points + ' pts' : 'Badge only'));
  container.append(row);
}

function conciseSummary(summary) {
  const clean = summary.replace(/\(\s*[,;]\s*/g, '(').trim();
  const lead = summarySentences?.segment(clean)[Symbol.iterator]().next().value?.segment.trim()
    ?? clean.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? clean;
  if (lead.length <= 190) return lead;
  const breakAt = lead.lastIndexOf(' ', 188);
  return lead.slice(0, breakAt > 0 ? breakAt : 188).replace(/[,;:]$/, '') + '…';
}

function renderResult(article, stored, animateReveal = false) {
  revealed = article;
  byId('draw-card').hidden = true;
  byId('result').hidden = false;
  const quizAnswer = typeof article.quizAnswer?.answer === 'string' ? article.quizAnswer : null;
  byId('result-mode').textContent = quizAnswer ? 'Today’s Quiz Complete' : 'Today’s Card';
  const tier = rarityName(article);
  byId('result').dataset.tier = article.tierId ?? 'archive';
  writeRarity(byId('result-unlock'), article, tier === 'Unrated' ? 'Archived discovery' : tier + ' card unlocked');
  byId('result-title').textContent = article.title;
  writeRarity(byId('result-card-type'), article);
  byId('result-topic').textContent = article.topic;
  byId('result-views').textContent = viewLabel(article);
  byId('quiz-feedback').hidden = !quizAnswer;
  byId('quiz-feedback').textContent = quizAnswer
    ? (quizAnswer.correct ? 'Correct! ' : 'Correct answer · ') + quizAnswer.answer
    : '';
  if (quizAnswer?.rarityRestricted === true) byId('quiz-feedback').append(' · Silver or Bronze draw');
  byId('result-description').textContent = conciseSummary(article.summary);
  writeCardDate('result', article.drawnAt, resolvedDay);
  byId('source-link').href = sourceFor(article);
  byId('result-credit').hidden = !article.revision;
  if (article.revision) byId('revision-link').href = 'https://en.wikipedia.org/w/index.php?oldid=' + article.revision;
  byId('score-value').textContent = article.score;
  byId('result-badges').textContent = article.badges.length + (article.badges.length === 1 ? ' badge on this card' : ' badges on this card');
  const percent = article.rank * 100 / article.poolSize;
  byId('result-percentile').textContent = 'Top ' + numberLabel.format(percent) + '% by score among ' + article.poolSize + ' articles.';
  const reasons = byId('reasons');
  reasons.replaceChildren();
  writeReason(reasons, 'Points for drawing a card', 100);
  for (const { badge, label, hits, points } of article.reasons) {
    const explanation = badge === article.topic ? 'The article is in the ' + article.topic + ' category' : (badgeExplanations[badge] ?? label);
    writeReason(reasons, explanation, points, 'This badge appears on ' + hits + ' of ' + article.poolSize + ' cards.');
  }
  byId('result-edition').textContent = editionLabel(article) + ' · ' + article.poolSize + ' articles';
  byId('saved-message').textContent = stored ? 'Daily draw complete. Saved to your achievements.' : fallbackNotice;
  articleMedia.show(article);
  const flipper = byId('knowledge-flipper');
  flipper.classList.remove('is-flipping');
  if (animateReveal) {
    void flipper.offsetWidth;
    flipper.classList.add('is-flipping');
    byId('result-title').focus({ preventScroll: true });
    byId('knowledge-stage').scrollIntoView({ block: 'nearest' });
  }
}

function renderDaily() {
  const current = storedResult(resolvedDay);
  if (current) {
    renderResult(current.article, current.stored);
  } else {
    revealed = null;
    articleMedia.clear();
    byId('result').hidden = true;
    byId('draw-card').hidden = false;
  }
}

function updateClock() {
  const now = new Date();
  const today = dayKey(now);
  const limit = byId('draw-limit-dialog');
  if (resolvedDay !== today) {
    resolvedDay = today;
    byId('today-label').textContent = dateLabel.format(now) + ' · UTC';
    byId('draw-notice').textContent = '';
    renderJournal();
    renderDaily();
    if (limit.open) {
      limit.close();
      if (activeView === 'daily' && !byId('draw-card').hidden) byId('draw-button').focus();
    }
  }
  const remaining = Math.ceil((dayLength - (now.getTime() % dayLength)) / 1000);
  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor(remaining / 60) % 60;
  const seconds = remaining % 60;
  const countdown = [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
  byId('countdown').textContent = countdown;
  if (limit.open) byId('draw-limit-countdown').textContent = countdown;
}

function showView(moveFocus = false) {
  const hash = location.hash.slice(1);
  if (hash === 'main') return;
  const view = screens.includes(hash) ? hash : 'daily';
  const changed = view !== activeView;
  activeView = view;
  for (const screen of screens) byId(screen).hidden = screen !== view;
  for (const item of document.querySelectorAll('nav [data-view]')) {
    if (item.dataset.view === view) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  }
  if (view === 'journal') renderJournal();
  if (view === 'pool') renderPool();
  if (view === 'daily' && changed) renderDaily();
  if (moveFocus && changed) {
    byId(view + '-title').setAttribute('tabindex', '-1');
    byId(view + '-title').focus({ preventScroll: true });
    if (hash === view) window.scrollTo(0, 0);
    else byId(hash)?.scrollIntoView();
  }
}

function questionFor(day) {
  const index = Math.floor(Date.parse(day) / dayLength) % quizQuestions.length;
  return quizQuestions[index];
}

function showDrawLimit() {
  byId('draw-limit-countdown').textContent = byId('countdown').textContent;
  byId('draw-limit-dialog').showModal();
}

function requestDailyDraw() {
  if (busy || byId('quiz-dialog').open || byId('draw-limit-dialog').open) return;
  updateClock();
  if (storedResult(resolvedDay)) {
    if (byId('result').hidden) renderDaily();
    showDrawLimit();
    return;
  }
  quizDay = resolvedDay;
  const question = questionFor(quizDay);
  byId('quiz-question').textContent = question.prompt;
  const options = byId('quiz-options');
  options.replaceChildren();
  question.choices.forEach((choice, index) => {
    const option = element('button', 'outline', choice);
    option.type = 'button';
    option.addEventListener('click', () => startDaily(index));
    options.append(option);
  });
  byId('quiz-dialog').showModal();
}

async function startDaily(selected) {
  if (busy || !byId('quiz-dialog').open) return;
  busy = true;
  byId('draw-button').disabled = true;
  byId('draw-button-label').textContent = 'Unlocking your card…';
  byId('draw-notice').textContent = '';
  byId('quiz-dialog').close();
  try {
    const dayAnswered = quizDay;
    const question = questionFor(dayAnswered);
    const draw = () => {
      const now = new Date();
      const date = dayKey(now);
      if (date !== dayAnswered) return null;
      const correct = selected === question.correct;
      const quizAnswer = { correct, rarityRestricted: !correct, answer: question.choices[question.correct] };
      return { ...saveDaily(date, now.toISOString(), quizAnswer), date };
    };
    const result = navigator.locks
      ? await navigator.locks.request('curiodraw-preview-daily', draw)
      : draw();
    updateClock();
    renderJournal();
    if (result?.date === resolvedDay) {
      renderResult(result.article, result.stored, result.fresh);
      if (!result.fresh) showDrawLimit();
    } else {
      renderDaily();
      byId('draw-notice').textContent = 'A new UTC day has started. Open today’s quiz again.';
    }
  } catch {
    byId('draw-notice').textContent = 'We couldn’t open this draw. Try again.';
  } finally {
    busy = false;
    byId('draw-button').disabled = false;
    byId('draw-button-label').textContent = 'Start Today’s Quiz';
  }
}

function openShare() {
  if (!revealed) return;
  byId('share-text').value = 'My WikiRNG daily discovery: ' + revealed.title + '\n' + revealed.score + ' points · ' +
    rarityName(revealed) + '\n' + sourceFor(revealed);
  byId('share-dialog').showModal();
}

async function copyResult() {
  const field = byId('share-text');
  try {
    await navigator.clipboard.writeText(field.value);
    byId('copy-result').textContent = 'Copied';
  } catch {
    field.focus();
    field.select();
    byId('copy-result').textContent = 'Text selected';
  }
}

for (const tier of drawRules.tiers) {
  const option = element('option', null, tier.name);
  option.value = tier.id;
  byId('journal-filter').append(option);
}
for (const topic of [...new Set(catalog.map((article) => article.topic))].sort()) {
  const option = element('option', null, topic);
  option.value = topic;
  byId('pool-filter').append(option);
}

byId('pool-size').textContent = ratedCards.length;
byId('edition-date').textContent = 'Snapshot ' + articleEdition.date;
for (const button of byId('odds-buttons').querySelectorAll('button')) {
  button.addEventListener('click', () => showOdds(button.dataset.tier));
}
showOdds('bronze');
byId('draw-button').addEventListener('click', requestDailyDraw);
byId('result-draw-again').addEventListener('click', requestDailyDraw);
byId('pool-filter').addEventListener('change', () => { poolPage = 0; renderPool(); });
byId('pool-prev').addEventListener('click', () => { poolPage -= 1; renderPool(); });
byId('pool-next').addEventListener('click', () => { poolPage += 1; renderPool(); });
byId('journal-filter').addEventListener('change', () => { collectionPage = 0; renderJournal(); });
for (const button of document.querySelectorAll('[data-collection-status]')) {
  button.addEventListener('click', () => {
    collectionStatus = button.dataset.collectionStatus;
    collectionPage = 0;
    for (const item of document.querySelectorAll('[data-collection-status]')) item.setAttribute('aria-pressed', String(item === button));
    renderJournal();
  });
}
byId('collection-prev').addEventListener('click', () => { collectionPage -= 1; renderJournal(); });
byId('collection-next').addEventListener('click', () => { collectionPage += 1; renderJournal(); });
byId('collection-dialog').addEventListener('close', () => {
  if (!byId('collection-dialog').open) articleMedia.clear(byId('collection-unlocked'));
});
byId('share-button').addEventListener('click', openShare);
byId('copy-result').addEventListener('click', copyResult);
byId('share-dialog').addEventListener('close', () => { byId('copy-result').textContent = 'Copy result'; });
window.addEventListener('hashchange', () => showView(true));
window.addEventListener('storage', (event) => {
  if (event.key !== null && ![dayKeyPrefix, oldDayKeyPrefix].some((prefix) => event.key.startsWith(prefix))) return;
  renderJournal();
  renderDaily();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateClock();
});

updateClock();
showView();
window.setInterval(updateClock, 1000);
