import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import * as L from "leaflet";
import {
  ActivityResponse,
  TripDayResponse,
} from "../../../core/models/trip.model";
import { formatTime } from "../../../shared/utils/format-time";
import { tripPinColor } from "./trip-pin-color";

/** Muted route line so it reads as a connector, not a competing colour. */
const ROUTE_COLOR = "#68788f";
/** Fallback world view when a day has no located activities and no trip centre. */
const DEFAULT_CENTER: L.LatLngTuple = [20, 0];
const DEFAULT_ZOOM = 2;

@Component({
  selector: "app-trip-map",
  standalone: true,
  imports: [TranslateModule],
  templateUrl: "./trip-map.component.html",
})
export class TripMapComponent implements OnDestroy {
  private readonly translate = inject(TranslateService);

  readonly day = input<TripDayResponse | null>(null);
  readonly centerLat = input<number | null>(null);
  readonly centerLng = input<number | null>(null);
  readonly focusedActivityId = input<number | null>(null);

  readonly focusActivity = output<number>();

  private readonly mapEl =
    viewChild.required<ElementRef<HTMLElement>>("mapEl");

  private map?: L.Map;
  private readonly markers = new Map<number, L.Marker>();
  private routeLine?: L.Polyline;

  /** Activities of the day that can actually be placed on the map. */
  private readonly located = computed(() =>
    (this.day()?.activities ?? [])
      .filter((a) => a.latitude != null && a.longitude != null)
      .sort(compareByStartTime),
  );

  readonly hasLocations = computed(() => this.located().length > 0);
  readonly hiddenCount = computed(
    () => (this.day()?.activities ?? []).length - this.located().length,
  );

  constructor() {
    // Init only after the host element is in the DOM — removes the
    // "effect fires before the view exists" race entirely.
    afterNextRender(() => {
      this.map = L.map(this.mapEl().nativeElement, {
        attributionControl: true,
      });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(this.map);
      this.renderDay();
      // Container has a deterministic height (h-72/h-96), so one pass is enough.
      setTimeout(() => this.map?.invalidateSize());
    });

    // Re-render when the selected day changes. Imperative Leaflet only — no
    // signal writes here (would throw NG0600).
    effect(() => {
      this.day();
      if (!this.map) return;
      this.renderDay();
    });

    // Focus a pin when the list asks for it (locate button / row select).
    effect(() => {
      const id = this.focusedActivityId();
      if (!this.map || id == null) return;
      const marker = this.markers.get(id);
      if (!marker) return;
      const latlng = marker.getLatLng();
      // Skip the redundant pan when the pin is already in view (e.g. the pin
      // click that set this id in the first place).
      if (!this.map.getBounds().contains(latlng)) {
        this.map.panTo(latlng);
      }
      marker.openPopup();
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    this.map = undefined;
  }

  private renderDay(): void {
    const map = this.map;
    if (!map) return;

    this.markers.forEach((m) => m.remove());
    this.markers.clear();
    this.routeLine?.remove();
    this.routeLine = undefined;

    const located = this.located();
    if (located.length === 0) {
      const lat = this.centerLat();
      const lng = this.centerLng();
      if (lat != null && lng != null) {
        map.setView([lat, lng], 11);
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
      return;
    }

    const latlngs: L.LatLngTuple[] = [];
    located.forEach((activity, index) => {
      const latlng: L.LatLngTuple = [activity.latitude!, activity.longitude!];
      latlngs.push(latlng);
      const marker = L.marker(latlng, { icon: buildPinIcon(index) })
        .bindPopup(this.buildPopup(activity))
        .addTo(map);
      marker.on("click", () => this.focusActivity.emit(activity.id));
      this.markers.set(activity.id, marker);
    });

    if (located.length >= 2) {
      this.routeLine = L.polyline(latlngs, {
        color: ROUTE_COLOR,
        weight: 3,
        opacity: 0.6,
        dashArray: "6 8",
      }).addTo(map);
    }

    if (located.length === 1) {
      map.setView(latlngs[0], 14);
    } else {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }
  }

  /** Build the popup as DOM (textContent) so user-entered names can't inject HTML. */
  private buildPopup(activity: ActivityResponse): HTMLElement {
    const root = document.createElement("div");
    root.className = "space-y-0.5";

    appendLine(root, activity.name, "font-semibold text-sm text-on-surface");

    const time = formatTimeRange(activity);
    if (time) {
      appendLine(root, time, "text-xs text-on-surface-variant tabular-nums");
    }

    const category = this.translate.instant(
      "TRIPS.CATEGORIES." + (activity.category ?? "NONE"),
    );
    appendLine(root, category, "text-xs text-on-surface-variant");

    if (activity.location) {
      appendLine(root, activity.location, "text-xs text-on-surface-variant");
    }

    return root;
  }
}

function compareByStartTime(a: ActivityResponse, b: ActivityResponse): number {
  if (a.startTime == null && b.startTime == null) return 0;
  if (a.startTime == null) return 1; // nulls sink to the end
  if (b.startTime == null) return -1;
  return a.startTime.localeCompare(b.startTime);
}

function formatTimeRange(activity: ActivityResponse): string {
  if (!activity.startTime) return "";
  const start = formatTime(activity.startTime);
  return activity.endTime ? `${start} – ${formatTime(activity.endTime)}` : start;
}

function appendLine(parent: HTMLElement, text: string, className: string): void {
  const p = document.createElement("p");
  p.className = className;
  p.textContent = text;
  parent.appendChild(p);
}

/** Numbered, colour-coded circle. Static Tailwind classes are picked up by the
 *  content scanner; the per-pin colour is dynamic so it stays inline. */
function buildPinIcon(index: number): L.DivIcon {
  const color = tripPinColor(index);
  return L.divIcon({
    className: "",
    html:
      `<div class="flex items-center justify-center w-7 h-7 rounded-full ` +
      `text-white text-xs font-bold ring-2 ring-white shadow-md" ` +
      `style="background-color:${color}">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}
