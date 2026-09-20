// Typology media gallery: every medium is already in the HTML, so switching is only a
// matter of `hidden` + `aria-selected`; the video plays while its panel is on screen and
// is the selected medium, and pauses otherwise. Panel visibility comes from an
// IntersectionObserver, which works the same under the GSAP-translated desktop track
// and the native swipe track on phones.
const PANEL_VISIBLE = 0.6;

export const mountTypologyMedia = (root: HTMLElement) => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const galleries = Array.from(root.querySelectorAll<HTMLElement>('[data-media]'));
  if (!galleries.length) return () => {};
  const visible = new WeakSet<HTMLElement>();

  // Plays each video only while its own panel is the selected one and on screen; a
  // typology can hold several video media now, so every one of them is synced, not just
  // the first found in the gallery.
  const sync = (gallery: HTMLElement) => {
    const videos = Array.from(gallery.querySelectorAll<HTMLVideoElement>('video[data-video]'));
    if (!videos.length) return;
    // Inside the desktop pinned slot every gallery intersects at once; only the one the
    // engine marked `is-active` counts as on screen (see desktop/eredita.ts).
    const onScreen = visible.has(gallery) && (!gallery.parentElement?.hasAttribute('data-media-slot') || gallery.classList.contains('is-active'));
    videos.forEach((video) => {
      const shown = !(video.closest('[role="tabpanel"]') as HTMLElement).hidden;
      const play = video.parentElement?.querySelector<HTMLElement>('[data-play]');
      if (shown && onScreen && !reducedMotion) video.play().catch(() => {});
      else if (!shown || !onScreen) { video.pause(); if (shown && play && reducedMotion) play.hidden = false; }
    });
  };

  const cleanups: (() => void)[] = [];
  galleries.forEach((gallery) => {
    const tabs = Array.from(gallery.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const panes = Array.from(gallery.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
    const strip = gallery.querySelector<HTMLElement>('[role="tablist"]');
    const prev = gallery.querySelector<HTMLButtonElement>('[data-thumbs-prev]');
    const next = gallery.querySelector<HTMLButtonElement>('[data-thumbs-next]');

    const select = (index: number) => {
      tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
      panes.forEach((pane, i) => { pane.hidden = i !== index; });
      tabs[index]?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' });
      sync(gallery);
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index));
      // Arrows move the focus along the strip (manual activation) and never reach the
      // swipe track, whose own arrow keys would change the typology.
      tab.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        event.stopPropagation();
        tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length].focus();
      });
    });

    // Prev/next only when the strip overflows; each press scrolls most of a strip width.
    if (strip && prev && next) {
      const arrows = () => { const overflow = strip.scrollWidth > strip.clientWidth + 1; prev.hidden = !overflow; next.hidden = !overflow; };
      const scroll = (direction: 1 | -1) => strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: reducedMotion ? 'auto' : 'smooth' });
      prev.addEventListener('click', () => scroll(-1));
      next.addEventListener('click', () => scroll(1));
      arrows();
      window.addEventListener('resize', arrows, { passive: true });
      cleanups.push(() => window.removeEventListener('resize', arrows));
    }

    // Reduced motion: no autoplay; the poster stays until the person asks for the video.
    // Each video medium carries its own play button right beside it in the markup.
    gallery.querySelectorAll<HTMLVideoElement>('video[data-video]').forEach((video) => {
      const play = video.parentElement?.querySelector<HTMLButtonElement>('[data-play]');
      if (!play) return;
      if (reducedMotion) play.hidden = false;
      play.addEventListener('click', () => { play.hidden = true; video.play().catch(() => {}); });
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const gallery = entry.target as HTMLElement;
      if (entry.intersectionRatio >= PANEL_VISIBLE) visible.add(gallery);
      else visible.delete(gallery);
      sync(gallery);
    });
  }, { threshold: [0, PANEL_VISIBLE] });
  galleries.forEach((gallery) => {
    observer.observe(gallery);
    // The desktop engine toggles `is-active` and asks for a resync instead of driving playback.
    gallery.addEventListener('typology-sync', () => sync(gallery));
  });

  return () => { observer.disconnect(); cleanups.forEach((cleanup) => cleanup()); };
};

// Masonry gallery videos: the bare `autoplay` attribute is not reliable once the item is
// below the fold, so each one is started explicitly as it scrolls into view (and paused
// once it leaves) instead of relying on the browser to honor the HTML attribute alone.
export const mountGalleryVideos = (root: HTMLElement) => {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('[data-gallery-video]'));
  if (!videos.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target as HTMLVideoElement;
      if (entry.isIntersecting) video.play().catch(() => {});
      else video.pause();
    });
  }, { threshold: 0.25 });
  videos.forEach((video) => observer.observe(video));
  return () => observer.disconnect();
};
