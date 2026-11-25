'use strict';

const articleMedia = (() => {
  const metadataFields = 'Artist|LicenseShortName|LicenseUrl|Restrictions';
  const ignoredFiles = /(?:^|[ _-])(?:flag|icon|logo|symbol|ambox|pictogram|edit|wikimedia|commons-logo)(?:[ _.-]|$)/i;
  const freeLicense = /^(?:CC BY(?:-SA)? \d(?:\.\d)?|CC0(?: 1\.0)?|Public domain)$/i;
  const cache = new Map();
  const pending = new Map();
  const active = new WeakMap();
  const covers = new WeakMap();
  const coverObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      coverObserver.unobserve(entry.target);
      const cover = covers.get(entry.target);
      if (cover) fillCover(cover.image, cover.article);
    }
  }) : null;

  function authorizedUrl(raw, hosts) {
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' && hosts.includes(url.hostname) ? url : null;
    } catch {
      return null;
    }
  }

  function textOnly(html) {
    const content = document.createElement('template');
    content.innerHTML = html ?? '';
    return content.content.textContent.trim().replace(/\s+/g, ' ');
  }

  async function wikiQuery(host, params, signal) {
    const query = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', origin: '*', ...params });
    const response = await fetch('https://' + host + '/w/api.php?' + query, { signal, credentials: 'omit' });
    if (!response.ok) throw new Error('Image request failed');
    const body = await response.json();
    if (body.error) throw new Error('Image catalogue unavailable');
    return body.query?.pages ?? [];
  }

  async function remoteImages(article, signal) {
    const page = (await wikiQuery('en.wikipedia.org', {
      ...(article.id ? { pageids: article.id } : { titles: article.title }),
      prop: 'images|pageimages', imlimit: '42', piprop: 'name', pilicense: 'free'
    }, signal))[0];
    const featured = page?.pageimage && 'File:' + page.pageimage;
    const names = [...new Set([featured, ...(page?.images ?? []).map(({ title }) => title)])]
      .filter((name) => name && /\.(?:jpe?g|png|webp)$/i.test(name) && !ignoredFiles.test(name))
      .slice(0, 24);
    if (!names.length) return [];
    const results = await wikiQuery('commons.wikimedia.org', {
      titles: names.join('|'), prop: 'imageinfo', iiurlwidth: '500', iiprop: 'url|size|mime|extmetadata',
      iiextmetadatafilter: metadataFields
    }, signal);

    const photos = new Map();
    for (const file of results) {
      const info = file.imageinfo?.[0];
      const data = info?.extmetadata;
      const license = data?.LicenseShortName?.value?.trim() ?? '';
      const author = textOnly(data?.Artist?.value);
      const photo = authorizedUrl(info?.thumburl || info?.url, ['upload.wikimedia.org', 'thumb.wikimedia.org']);
      const source = authorizedUrl(info?.descriptionurl, ['commons.wikimedia.org']);
      const licenseUrl = authorizedUrl(data?.LicenseUrl?.value, ['creativecommons.org']);
      if (!photo || !source || !author || !freeLicense.test(license) || data?.Restrictions?.value ||
          info.width < 200 || info.height < 120) continue;
      photo.search = '';
      photos.set(file.title.replaceAll('_', ' '), {
        photo: photo.href, source: source.href, author, license, licenseUrl: licenseUrl?.href,
        caption: file.title.replace(/^File:/, '').replace(/\.[^.]+$/, '').replaceAll('_', ' ')
      });
    }
    const distinct = [];
    const captions = new Set();
    for (const name of names) {
      const item = photos.get(name.replaceAll('_', ' '));
      if (!item) continue;
      const key = item.caption.toLowerCase().replace(/\b(?:crop|cropped|detail|thumbnail)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
      if (captions.has(key)) continue;
      captions.add(key);
      distinct.push(item);
      if (distinct.length === 4) break;
    }
    return distinct;
  }

  function render(media, target, request) {
    const gallery = target.querySelector('[data-media-gallery]');
    const credits = target.querySelector('[data-media-credits]');
    const creditList = credits.querySelector('ul');
    const status = target.querySelector('[data-media-status]');
    gallery.replaceChildren();
    creditList.replaceChildren();
    credits.hidden = !media.length;
    status.hidden = Boolean(media.length);
    status.textContent = media.length ? '' : 'No licensed article images available.';

    for (const item of media) {
      const panel = document.createElement('figure');
      panel.className = 'article-photo';
      const view = document.createElement('a');
      view.href = item.source;
      view.target = '_blank';
      view.rel = 'noopener noreferrer';
      view.title = item.caption;
      const image = document.createElement('img');
      image.alt = item.caption;
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      view.append(image);
      panel.append(view);

      const credit = document.createElement('li');
      const source = view.cloneNode();
      source.textContent = item.caption;
      credit.append(source, ' — ' + item.author + ' · ');
      if (item.licenseUrl) {
        const license = view.cloneNode();
        license.href = item.licenseUrl;
        license.textContent = item.license;
        credit.append(license);
      } else {
        credit.append(item.license);
      }

      image.addEventListener('error', () => {
        if (active.get(target) !== request || !panel.isConnected) return;
        panel.remove();
        credit.remove();
        if (gallery.childElementCount) return;
        credits.hidden = true;
        status.hidden = false;
        status.textContent = 'Article images could not be loaded.';
      }, { once: true });
      gallery.append(panel);
      creditList.append(credit);
      image.src = item.photo;
    }
  }

  function clear(target = document.getElementById('result')) {
    active.delete(target);
  }

  async function getImages(article) {
    const key = article.id ?? article.slug;
    if (Object.hasOwn(localArticleMedia, article.title)) return localArticleMedia[article.title];
    if (cache.has(key)) return cache.get(key);
    if (pending.has(key)) return pending.get(key);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    const request = remoteImages(article, controller.signal).then((images) => {
      cache.set(key, images);
      return images;
    }).finally(() => {
      clearTimeout(timeout);
      pending.delete(key);
    });
    pending.set(key, request);
    return request;
  }

  async function show(article, target = document.getElementById('result')) {
    const key = article.id ?? article.slug;
    if (active.get(target)?.key === key) return;
    const request = { key };
    active.set(target, request);
    render([], target, request);
    const status = target.querySelector('[data-media-status]');
    status.textContent = 'Loading article images…';
    try {
      const images = await getImages(article);
      if (active.get(target) === request) render(images, target, request);
    } catch {
      if (active.get(target) === request) status.textContent = 'Article images could not be loaded.';
    }
  }

  async function fillCover(image, article) {
    if (!image.isConnected || !article) return;
    try {
      for (const item of await getImages(article)) {
        if (!image.isConnected) return;
        image.src = item.photo;
        try {
          await image.decode();
          image.hidden = false;
          return;
        } catch {
          // Try the next licensed image if this file is unavailable.
        }
      }
    } catch {
      // The cover retains its original artwork when the image service is unavailable.
    }
  }

  function cover(image, article) {
    if (!coverObserver) return fillCover(image, article);
    const frame = image.parentElement;
    covers.set(frame, { image, article });
    coverObserver.observe(frame);
  }

  function clearCovers() {
    coverObserver?.disconnect();
  }

  return { clear, show, cover, clearCovers };
})();
