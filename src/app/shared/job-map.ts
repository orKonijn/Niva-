import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type * as Leaflet from 'leaflet';
import type { Job } from '../core/models/job';
import { directionsUrl, groupLocations } from '../core/job-locations';
@Component({
  selector: 'niva-job-map',
  imports: [RouterLink],
  templateUrl: './job-map.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobMap {
  readonly jobs = input.required<readonly Job[]>();
  readonly groups = computed(() => groupLocations(this.jobs()));
  readonly remote = computed(() => this.jobs().filter((job) => job.workStyle === 'remote'));
  readonly missing = computed(() =>
    this.jobs().filter(
      (job) =>
        job.workStyle !== 'remote' &&
        !this.groups().some((group) => group.jobs.some((j) => j.id === job.id)),
    ),
  );
  readonly status = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly selected = signal<string | null>(null);
  readonly directionsUrl = directionsUrl;
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  private map?: Leaflet.Map;
  private library?: typeof Leaflet;
  private layer?: Leaflet.LayerGroup;
  private markers = new Map<string, Leaflet.Marker>();
  private fitted = false;
  private destroyed = false;
  constructor() {
    afterNextRender(() => {
      void this.initialize();
    });
    effect(() => {
      this.groups();
      if (this.map) this.render();
    });
  }
  private async initialize(): Promise<void> {
    try {
      const L = await import('leaflet/dist/leaflet-src.esm.js');
      if (this.destroyed) return;
      this.library = L;
      this.map = L.map(this.canvas().nativeElement, {
        zoomControl: false,
        scrollWheelZoom: false,
        keyboard: true,
      }).setView([31.8, 34.9], 8);
      L.control
        .zoom({
          zoomInTitle: 'התקרבות',
          zoomOutTitle: 'התרחקות',
          zoomInText: '+',
          zoomOutText: '−',
        })
        .addTo(this.map);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        maxZoom: 18,
      })
        .on('tileerror', () => this.status.set('unavailable'))
        .addTo(this.map);
      this.layer = L.layerGroup().addTo(this.map);
      this.status.set('ready');
      this.render();
    } catch {
      this.status.set('unavailable');
    }
  }
  private render(): void {
    const L = this.library;
    if (!L || !this.map || !this.layer) return;
    this.layer.clearLayers();
    this.markers.clear();
    for (const group of this.groups()) {
      const marker = L.marker([group.office.latitude!, group.office.longitude!], {
        title: `${group.office.city}: ${group.jobs.length} משרות באזור משוער`,
        alt: `${group.office.city}: ${group.jobs.length} משרות`,
        icon: L.divIcon({
          html: String(group.jobs.length),
          className: 'niva-map-marker',
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
        keyboard: true,
      });
      const content = document.createElement('div');
      content.dir = 'rtl';
      const title = document.createElement('strong');
      title.textContent = `${group.office.city} · מיקום עירוני משוער${group.office.demonstration ? ' לדוגמה' : ' לפי המקור'}`;
      content.append(title);
      for (const job of group.jobs) {
        const link = document.createElement('a');
        link.textContent = `${job.title} · ${job.company} — לפרטי המשרה`;
        link.href = `/app/jobs/${encodeURIComponent(job.id)}`;
        link.className = 'block min-h-11 py-3 text-brand';
        content.append(link);
      }
      marker
        .bindPopup(content, {
          maxWidth: Math.min(300, Math.max(120, this.map.getSize().x - 80)),
          minWidth: 120,
          maxHeight: 240,
        })
        .on('click', () => this.selected.set(group.key))
        .on('add', () =>
          marker
            .getElement()
            ?.setAttribute(
              'aria-label',
              `${group.office.city}: ${group.jobs.length} משרות באזור משוער`,
            ),
        )
        .on('popupopen', () => {
          const close = marker
            .getPopup()
            ?.getElement()
            ?.querySelector('.leaflet-popup-close-button');
          close?.setAttribute('aria-label', 'סגירת פרטי המיקום');
          close?.setAttribute('title', 'סגירת פרטי המיקום');
        })
        .addTo(this.layer);
      this.markers.set(group.key, marker);
    }
    if (!this.fitted && this.groups().length) {
      this.fit();
      this.fitted = true;
    }
    if (this.selected() && !this.markers.has(this.selected()!)) this.selected.set(null);
  }
  fit(): void {
    const L = this.library;
    if (L && this.map && this.groups().length)
      this.map.fitBounds(
        L.latLngBounds(
          this.groups().map((g) => [g.office.latitude!, g.office.longitude!] as [number, number]),
        ),
        { padding: [35, 35], maxZoom: 11, animate: false },
      );
  }
  select(key: string): void {
    this.selected.set(key);
    this.markers.get(key)?.openPopup();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    this.map?.remove();
  }
}
