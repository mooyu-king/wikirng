'use strict';

const drawRules = (() => {
  const tiers = [
    { id: 'crown', name: 'Crown', weight: 5, wrongWeight: 0 },
    { id: 'diamond', name: 'Diamond', weight: 20, wrongWeight: 0 },
    { id: 'gold', name: 'Gold', weight: 10000, wrongWeight: 0 },
    { id: 'silver', name: 'Silver', weight: 20000, wrongWeight: 20000 },
    { id: 'bronze', name: 'Bronze', weight: 69975, wrongWeight: 80000 }
  ];
  const oddsScale = tiers.reduce((sum, tier) => sum + tier.weight, 0);
  const topicSignals = {
    'Arts & history': 'Arts & history dossier',
    'Life': 'Life sciences dossier',
    'Technology': 'Technology dossier',
    'Culture': 'Culture dossier',
    'Earth': 'Earth dossier',
    'Space & science': 'Space & science dossier'
  };

  const fieldSignals = {
    mapped: 'Coordinates recorded',
    concise: 'Short reference',
    extensive: 'Long reference',
    notation: 'Qualified title',
    numeric: 'Numbered title',
    long: 'Multiword title'
  };

  function buildEdition(snapshot) {
    const poolSize = snapshot.articles.length;
    const claims = snapshot.articles.map((entry) => {
      const [id, title, topic, revision, bytes, hasCoordinates, summary] = entry;
      const badges = [topic];
      if (hasCoordinates) badges.push('mapped');
      if (bytes <= 24_000) badges.push('concise');
      if (bytes >= 115_000) badges.push('extensive');
      if (/\([^)]*\)$/.test(title)) badges.push('notation');
      if (/\d/.test(title)) badges.push('numeric');
      if (title.trim().split(/\s+/u).length >= 5) badges.push('long');
      return { id: String(id), title, topic, revision, bytes, hasCoordinates, summary, badges };
    });
    const counts = new Map();
    for (const { badges } of claims) {
      for (const badge of badges) counts.set(badge, (counts.get(badge) ?? 0) + 1);
    }

    const scored = claims.map((article) => {
      const reasons = article.badges.map((badge) => {
        const hits = counts.get(badge);
        const group = badge === article.topic ? 'topic' : ['notation', 'numeric', 'long'].includes(badge) ? 'title' : 'article';
        const label = topicSignals[badge] ?? fieldSignals[badge];
        const raw = Math.min(120, Math.round(20 * -Math.log2((hits + 1) / (poolSize + 2))));
        return { badge, label, hits, raw, points: raw, group };
      }).sort((a, b) => b.raw - a.raw || a.badge.localeCompare(b.badge));

      const used = new Set();
      for (const reason of reasons) {
        if (used.has(reason.group)) reason.points = 0;
        used.add(reason.group);
      }
      const score = 100 + reasons.reduce((total, reason) => total + reason.points, 0);
      return { ...article, poolSize, reasons, score, edition: snapshot.version, sourceType: 'wikipedia-excerpt' };
    });
    return addRanks(scored);
  }

  function addRanks(scored) {
    const totals = new Map();
    for (const { score } of scored) totals.set(score, (totals.get(score) ?? 0) + 1);
    let included = 0;
    const ranks = new Map([...totals].sort(([left], [right]) => right - left).map(([score, count]) => {
      included += count;
      return [score, included];
    }));
    return scored.map((article) => ({ ...article, rank: ranks.get(article.score) }));
  }

  function uniformIndex(length) {
    if (length < 1 || length > 2 ** 32) throw new RangeError('Invalid draw pool size');
    const sample = new Uint32Array(1);
    const upper = 2 ** 32 - (2 ** 32 % length);
    do {
      globalThis.crypto.getRandomValues(sample);
    } while (sample[0] >= upper);
    return sample[0] % length;
  }

  function buildRarityPool(articles, snapshot) {
    const ranked = articles.filter(({ id }) => Number.isInteger(snapshot.totals[id]) && snapshot.totals[id] >= 0)
      .sort((a, b) => snapshot.totals[a.id] - snapshot.totals[b.id] || Number(a.id) - Number(b.id));
    if (ranked.length < tiers.length) throw new RangeError('Not enough articles with verified pageviews.');
    let cumulative = 0;
    let from = 0;
    const rated = new Map();
    const bins = tiers.map((tier, index) => {
      cumulative += tier.weight;
      const remainingTiers = tiers.length - index - 1;
      const end = Math.min(ranked.length - remainingTiers, Math.max(from + 1, Math.ceil(ranked.length * cumulative / oddsScale)));
      const entries = ranked.slice(from, end).map((article) => {
        const record = { ...article, tierId: tier.id, views: snapshot.totals[article.id], viewMonth: snapshot.month };
        rated.set(record.id, record);
        return record;
      });
      from = end;
      return { ...tier, entries };
    });
    return { bins, articles: articles.map((article) => rated.get(article.id) ?? article) };
  }

  function tierWeight(tier, correct) {
    return correct ? tier.weight : tier.wrongWeight;
  }

  function formatOdds(tier, correct) {
    return (tierWeight(tier, correct) * 100 / oddsScale) + '%';
  }

  function drawByRarity(bins, correct, pick = uniformIndex) {
    let ticket = pick(oddsScale);
    for (const bin of bins) {
      const weight = tierWeight(bin, correct);
      if (ticket < weight) return bin.entries[pick(bin.entries.length)];
      ticket -= weight;
    }
    throw new RangeError('Invalid rarity draw');
  }

  return { addRanks, buildEdition, buildRarityPool, drawByRarity, formatOdds, tiers };
})();
