import { mountHorizontalTrack } from './horizontal-track';
import { mountLazyMaps } from './lazy-map';
import { mountGalleryVideos, mountTypologyMedia } from './typology-media';
import { mountAnchors, mountReveals, releaseTitles, settleLines, splitTitles } from './mobile-motion';

const root = document.querySelector<HTMLElement>('[data-eredita]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Phones get the CSS/IntersectionObserver runtime; the Lenis/GSAP engine is desktop-only
// and loaded on demand. Crossing the breakpoint after load needs a reload.
const desktop = window.matchMedia('(min-width: 768px)').matches;
let motion: { refresh: () => void } | null = null;

mountLazyMaps();

// Typology media (video + renders) within each panel: independent of GSAP/reduced motion,
// so it keeps working even when every animation is off. The sticky media stage/pin is
// desktop-only motion (see desktop/eredita.ts); mobile keeps each typology's media in place.
if (root) mountTypologyMedia(root);

// Mobile typologies: native swipe track with the shared counter/rail. The description and
// specs <details> ship open (desktop shows everything) and are closed here so the medium
// stays the dominant element; they reopen if the viewport crosses back to desktop.
if (root) {
  const track = root.querySelector<HTMLElement>('[data-h-track]');
  const details = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.ed-h-more'));
  const mobile = window.matchMedia('(max-width: 899px)');
  let unmount: (() => void) | null = null;
  const sync = () => {
    if (mobile.matches && track && !unmount) {
      details.forEach((item) => { item.open = false; });
      unmount = mountHorizontalTrack({
        track,
        cards: Array.from(track.querySelectorAll<HTMLElement>('[data-h-panel]')),
        current: root.querySelector<HTMLElement>('[data-pin-current]'),
        rail: root.querySelector<HTMLElement>('[data-pin-rail]'),
        label: 'Tipología',
        reducedMotion,
      });
    } else if (!mobile.matches && unmount) {
      unmount();
      unmount = null;
      details.forEach((item) => { item.open = true; });
    }
    motion?.refresh();
  };
  sync();
  mobile.addEventListener('change', sync);
}

// Gallery lightbox: photos expand directly; expanded videos use the same overlay with
// custom play, sound and seek controls while their inline preview stays autoplay/muted.
const gallery = root?.querySelector<HTMLElement>('.ed-masonry');
if (gallery) mountGalleryVideos(gallery);
if (gallery) {
  const overlay = document.createElement('div');
  overlay.className = 'ed-lightbox';
  overlay.innerHTML = '<button class="ed-lightbox-close" type="button" aria-label="Cerrar">✕</button><img alt="" hidden /><video playsinline hidden></video><div class="ed-lightbox-controls" hidden><button type="button" data-play aria-label="Pausar">❚❚</button><input type="range" min="0" max="1000" value="0" aria-label="Progreso del video"><button type="button" data-mute aria-label="Silenciar">●</button></div>';
  root!.appendChild(overlay);
  const img = overlay.querySelector('img') as HTMLImageElement;
  const video = overlay.querySelector('video') as HTMLVideoElement;
  const controls = overlay.querySelector('.ed-lightbox-controls') as HTMLElement;
  const play = controls.querySelector<HTMLButtonElement>('[data-play]')!;
  const mute = controls.querySelector<HTMLButtonElement>('[data-mute]')!;
  const progress = controls.querySelector<HTMLInputElement>('input')!;
  let preview: HTMLVideoElement | null = null;
  const syncPlay = () => { play.textContent = video.paused ? '▶' : '❚❚'; play.ariaLabel = video.paused ? 'Reproducir' : 'Pausar'; };
  const close = () => { overlay.classList.remove('is-open'); video.pause(); video.removeAttribute('src'); video.load(); preview?.play().catch(() => {}); preview = null; };
  overlay.addEventListener('click', (event) => { if (event.target === overlay) close(); });
  overlay.querySelector('.ed-lightbox-close')?.addEventListener('click', close);
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
  play.addEventListener('click', () => { if (video.paused) video.play().catch(() => {}); else video.pause(); });
  mute.addEventListener('click', () => { video.muted = !video.muted; mute.textContent = video.muted ? '○' : '●'; mute.ariaLabel = video.muted ? 'Activar sonido' : 'Silenciar'; });
  progress.addEventListener('input', () => { if (Number.isFinite(video.duration)) video.currentTime = Number(progress.value) / 1000 * video.duration; });
  video.addEventListener('play', syncPlay);
  video.addEventListener('pause', syncPlay);
  video.addEventListener('timeupdate', () => { if (Number.isFinite(video.duration)) progress.value = String(video.currentTime / video.duration * 1000); });
  const open = (target: HTMLElement) => {
    const clicked = target.closest<HTMLElement>('.ed-masonry-item')?.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
    if (!clicked) return;
    const isVideo = clicked instanceof HTMLVideoElement;
    img.hidden = isVideo;
    video.hidden = !isVideo;
    controls.hidden = !isVideo;
    if (isVideo) {
      preview = clicked;
      preview.pause();
      video.src = clicked.currentSrc || clicked.querySelector('source')?.src || '';
      video.poster = clicked.poster;
      video.muted = false;
      mute.textContent = '●';
      video.play().catch(() => {});
    } else img.src = clicked.currentSrc || clicked.src;
    overlay.classList.add('is-open');
  };
  gallery.addEventListener('click', (event) => open(event.target as HTMLElement));
  gallery.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open(event.target as HTMLElement);
  });
}

if (root && !reducedMotion) {
  // Titles are rebuilt as real lines first, so both engines animate the same lines.
  splitTitles(root, settleLines).then(() => {
    if (desktop) {
      import('./desktop/eredita').then(({ mount }) => { motion = mount(root); motion.refresh(); releaseTitles(); });
    } else {
      mountReveals(root, { hero: '.ed-hero' });
      releaseTitles();
      mountAnchors(false);
    }
  });
}
