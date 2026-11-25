'use strict';

const shareCard = (() => {
  const siteUrl = 'https://wikirng.org/';
  const byId = (id) => document.getElementById(id);
  const dialog = byId('share-dialog');
  const canvas = byId('share-canvas');
  const download = byId('share-download');
  const native = byId('share-native');
  const captionField = byId('share-text');
  const status = byId('share-status');
  const serif = 'Georgia, serif';
  const sans = '"Segoe UI", sans-serif';
  let current;

  function loadImage(src) {
    const image = new Image();
    if (/^https?:/.test(src)) image.crossOrigin = 'anonymous';
    image.referrerPolicy = 'no-referrer';
    image.src = src;
    return image.decode().then(() => image, () => null);
  }

  function withDeadline(task, ms, fallback) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(fallback), ms);
      task.then(resolve, () => resolve(fallback)).finally(() => clearTimeout(timer));
    });
  }

  function shorten(ctx, value, width) {
    if (ctx.measureText(value).width <= width) return value;
    let text = value;
    while (text && ctx.measureText(text + '…').width > width) text = text.slice(0, -1);
    return text.trimEnd() + '…';
  }

  function wrap(ctx, value, width, limit) {
    const words = value.trim().split(/\s+/);
    const lines = [];
    let line = '';
    while (words.length && lines.length < limit - 1) {
      const next = words[0];
      const joined = line ? line + ' ' + next : next;
      if (!line || ctx.measureText(joined).width <= width) {
        line = joined;
        words.shift();
      } else {
        lines.push(shorten(ctx, line, width));
        line = '';
      }
    }
    lines.push(shorten(ctx, [line, ...words].filter(Boolean).join(' '), width));
    return lines;
  }

  function shield(ctx, top) {
    const shape = new Path2D();
    shape.moveTo(242, top);
    shape.quadraticCurveTo(105, top, 105, top + 130);
    shape.lineTo(105, top + 405);
    shape.bezierCurveTo(105, top + 525, 210, top + 541, 344, top + 570);
    shape.bezierCurveTo(448, top + 593, 503, top + 652, 540, top + 652);
    shape.bezierCurveTo(577, top + 652, 632, top + 593, 736, top + 570);
    shape.bezierCurveTo(870, top + 541, 975, top + 525, 975, top + 405);
    shape.lineTo(975, top + 130);
    shape.quadraticCurveTo(975, top, 838, top);
    shape.closePath();
    const paper = ctx.createRadialGradient(515, top + 140, 28, 545, top + 235, 600);
    paper.addColorStop(0, '#fff8df');
    paper.addColorStop(1, '#eddaaf');
    const metal = ctx.createLinearGradient(100, top + 42, 995, top + 590);
    metal.addColorStop(0, '#be7d38');
    metal.addColorStop(.28, '#fff0ba');
    metal.addColorStop(.57, '#be783a');
    metal.addColorStop(.8, '#ffe29a');
    metal.addColorStop(1, '#c28846');
    ctx.save();
    ctx.shadowBlur = 43;
    ctx.shadowColor = '#f3bd63c9';
    ctx.fillStyle = paper;
    ctx.fill(shape);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = metal;
    ctx.lineWidth = 12;
    ctx.stroke(shape);
    ctx.restore();
  }

  function drawPhotos(ctx, photos) {
    const width = photos.length === 1 ? 360 : 252;
    const height = 235;
    photos.forEach(({ image }, index) => {
      const offset = index - (photos.length - 1) / 2;
      const factor = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const w = image.naturalWidth * factor;
      const h = image.naturalHeight * factor;
      ctx.save();
      ctx.translate(540 + offset * 270, 287 + Math.abs(offset) * 15);
      ctx.rotate(offset * .10);
      ctx.beginPath();
      ctx.roundRect(-width / 2, -height / 2, width, height, 20);
      ctx.clip();
      ctx.drawImage(image, -w / 2, -h / 2, w, h);
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#f5d38b';
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawPreview(session, photos = [], icon = null) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const { article, details } = session;
    const top = photos.length ? 375 : 270;
    const background = ctx.createRadialGradient(540, 418, 44, 540, 540, 810);
    background.addColorStop(0, '#66583b');
    background.addColorStop(.44, '#20372e');
    background.addColorStop(1, '#101924');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 1080, 1350);
    ctx.strokeStyle = '#e4bd743b';
    ctx.lineWidth = 2;
    ctx.strokeRect(38, 38, 1004, 1274);
    ctx.fillStyle = '#ffe8b197';
    for (const [x, y, radius] of [[136,190,3],[916,163,4],[91,403,3],[1008,470,3],[92,859,3],[960,908,4],[217,1004,3]]) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold 57px ' + serif;
    ctx.fillStyle = '#ffe5a5';
    ctx.fillText('WikiRNG', 540, 105);
    ctx.font = '600 22px ' + sans;
    ctx.fillStyle = '#f8eccd';
    ctx.fillText('DAILY DISCOVERY', 540, 146);
    drawPhotos(ctx, photos);
    shield(ctx, top);
    ctx.fillStyle = '#745529';
    ctx.font = 'bold 22px ' + sans;
    ctx.fillText('WIKIRNG FIELD COLLECTION', 540, top + 77);

    ctx.fillStyle = '#1b3028';
    ctx.font = '600 56px ' + serif;
    const title = wrap(ctx, article.title, 760, 3);
    title.forEach((line, index) => ctx.fillText(line, 540, top + 148 + index * 61));
    const summaryY = top + 195 + (title.length - 1) * 61;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#354337';
    ctx.font = '27px ' + sans;
    const summary = wrap(ctx, details.summary, 742, 3);
    summary.forEach((line, index) => ctx.fillText(line, 169, summaryY + index * 36));
    const ruleY = summaryY + summary.length * 36 + 12;
    ctx.strokeStyle = '#ab88515f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(170, ruleY);
    ctx.lineTo(910, ruleY);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1d3a2f';
    ctx.font = 'bold 28px ' + sans;
    const facts = details.rarity + ' · ' + article.topic + ' · ' + article.score + ' points';
    if (icon) {
      const start = 540 - ctx.measureText(facts).width / 2;
      ctx.drawImage(icon, start - 25, ruleY + 27, 29, 29);
    }
    ctx.fillText(shorten(ctx, facts, 670), icon ? 552 : 540, ruleY + 51);
    ctx.font = '23px ' + sans;
    ctx.fillText(shorten(ctx, details.date, 620), 540, ruleY + 88);

    ctx.fillStyle = '#ffe7a9';
    ctx.font = 'bold 43px ' + serif;
    ctx.fillText(siteUrl, 540, 1090);
    ctx.fillStyle = '#fff3da';
    ctx.font = '24px ' + sans;
    ctx.fillText('Wikipedia · ' + shorten(ctx, details.wikipedia, 799), 540, 1130);
    if (article.revision) {
      ctx.fillStyle = '#e0d2b9';
      ctx.font = '20px ' + sans;
      ctx.fillText('Edited excerpt by Wikipedia contributors · CC BY-SA 4.0', 540, 1170);
    }
    ctx.fillStyle = '#e0d2b9';
    ctx.font = '19px ' + sans;
    photos.forEach(({ credit }, index) => {
      ctx.fillText(shorten(ctx, 'Photo (cropped) · ' + credit.author + ' · ' + credit.license, 935), 540, 1204 + 29 * index);
    });
    return true;
  }

  async function getPhotos(article) {
    const media = await articleMedia.getImages(article, location.protocol !== 'file:');
    const photos = await Promise.all(media.slice(0, 3).map(async (credit) => ({
      credit,
      image: await loadImage(credit.photo)
    })));
    return photos.filter(({ image }) => image);
  }

  function toPng() {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Unable to encode share PNG'));
      }, 'image/png');
    });
  }

  function caption(session, includeSite, photos = session.photos) {
    const { article, details } = session;
    const lines = [article.title + ' · ' + details.rarity + ' · ' + article.score + ' points'];
    if (includeSite) lines.push('Play WikiRNG: ' + siteUrl);
    lines.push('Wikipedia: ' + details.wikipedia);
    if (article.revision) {
      lines.push('Edited excerpt by Wikipedia contributors, CC BY-SA 4.0: https://en.wikipedia.org/w/index.php?oldid=' + article.revision);
    }
    for (const { credit } of photos) {
      lines.push('Cropped photo by ' + credit.author + ', ' + credit.license + ': ' + credit.source +
        (credit.licenseUrl ? ' · ' + credit.licenseUrl : ''));
    }
    return lines.join('\n');
  }

  function setDestinations(article) {
    const headline = 'My WikiRNG daily discovery: ' + Array.from(article.title).slice(0, 155).join('');
    const x = new URL('https://twitter.com/intent/tweet');
    x.search = new URLSearchParams({ text: headline, url: siteUrl });
    byId('share-x').href = x.href;
    const reddit = new URL('https://www.reddit.com/submit');
    reddit.search = new URLSearchParams({ title: headline, url: siteUrl });
    byId('share-reddit').href = reddit.href;
  }

  async function prepare(session) {
    const svg = session.details.icon && new XMLSerializer().serializeToString(session.details.icon);
    const [photos, icon] = await Promise.all([
      withDeadline(getPhotos(session.article), 3600, []),
      svg ? withDeadline(loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)), 900, null) : null
    ]);
    if (current !== session || !dialog.open) return;
    let blob;
    try {
      drawPreview(session, photos, icon);
      blob = await toPng();
      session.photos = photos;
    } catch {
      if (current !== session || !dialog.open) return;
      canvas.width = 1080;
      drawPreview(session);
      try {
        blob = await toPng();
      } catch {
        if (current === session && dialog.open) status.textContent = 'The image could not be generated. You can still copy the site link or caption.';
        return;
      }
    }
    if (current !== session || !dialog.open) return;
    const slug = session.article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 72);
    session.file = new File([blob], 'wikirng-' + (slug || 'daily-card') + '.png', { type: 'image/png' });
    session.url = URL.createObjectURL(blob);
    captionField.value = caption(session, true);
    download.disabled = false;
    native.disabled = false;
    status.textContent = '';
  }

  function downloadImage(session) {
    const link = document.createElement('a');
    link.href = session.url;
    link.download = session.file.name;
    dialog.append(link);
    link.click();
    link.remove();
  }

  async function copyText(session, field, text, success, manual) {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(text);
      if (current === session && dialog.open) status.textContent = success;
    } catch {
      if (current !== session || !dialog.open) return;
      field.value = text;
      field.hidden = false;
      if (field === captionField) byId('share-caption').open = true;
      field.focus();
      field.select();
      status.textContent = manual;
    }
  }

  download.addEventListener('click', () => {
    if (!current?.file) return;
    downloadImage(current);
    status.textContent = 'PNG download started.';
  });
  native.addEventListener('click', async () => {
    const session = current;
    if (!session?.file) return;
    const files = [session.file];
    try {
      if (navigator.share && navigator.canShare?.({ files })) {
        await navigator.share({ files, title: session.article.title + ' · WikiRNG', text: caption(session, false), url: siteUrl });
        if (current === session && dialog.open) status.textContent = 'Sent to your selected share destination.';
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError' || current !== session || !dialog.open) return;
    }
    downloadImage(session);
    await copyText(session, captionField, caption(session, true),
      'PNG download started and caption copied. Attach the image and paste the caption in your app.',
      'PNG download started. Copy the selected caption and attach the image in your app.');
  });
  byId('share-copy').addEventListener('click', () =>
    copyText(current, byId('share-copy-fallback'), siteUrl, 'WikiRNG link copied.', 'Copy the selected WikiRNG link.'));
  byId('share-copy-caption').addEventListener('click', () => {
    if (current) copyText(current, captionField, caption(current, true), 'Caption copied.', 'Copy the selected caption.');
  });
  function releasePreview() {
    const url = current?.url;
    if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
    current = undefined;
  }
  dialog.addEventListener('close', () => {
    if (!dialog.open) releasePreview();
  });

  function open(article, details) {
    if (dialog.open) return;
    releasePreview();
    const session = { article, details, photos: [] };
    current = session;
    const wiki = byId('share-wikipedia');
    wiki.href = details.wikipedia;
    wiki.textContent = details.wikipedia;
    canvas.setAttribute('aria-label', article.title + ' · ' + details.rarity + ' WikiRNG share card');
    byId('share-caption').open = false;
    byId('share-copy-fallback').hidden = true;
    download.disabled = true;
    native.disabled = true;
    captionField.value = caption(session, true);
    setDestinations(article);
    drawPreview(session);
    status.textContent = 'Preparing PNG…';
    dialog.showModal();
    dialog.scrollTop = 0;
    prepare(session);
  }

  return { open };
})();
