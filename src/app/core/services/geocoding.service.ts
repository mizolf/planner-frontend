import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

export interface DestinationSuggestion {
  label: string;
  latitude: number;
  longitude: number;
}

export interface GeoBias {
  latitude: number;
  longitude: number;
}

interface PhotonFeature {
  geometry?: { coordinates?: number[] };
  properties?: { name?: string; city?: string; country?: string };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

const PHOTON_URL = "https://photon.komoot.io/api/";

const PHOTON_LANG = "en";
const REQUEST_LIMIT = 8;
const DISPLAY_LIMIT = 5;

@Injectable({ providedIn: "root" })
export class GeocodingService {
  private http = inject(HttpClient);

  search(query: string, bias?: GeoBias): Observable<DestinationSuggestion[]> {
    let params = new HttpParams()
      .set("q", query)
      .set("limit", REQUEST_LIMIT)
      .set("lang", PHOTON_LANG);
    if (bias) {
      params = params.set("lat", bias.latitude).set("lon", bias.longitude);
    }
    return this.http.get<PhotonResponse>(PHOTON_URL, { params }).pipe(
      map((res) => this.toSuggestions(res.features ?? [])),
      catchError(() => of([])),
    );
  }

  private toSuggestions(features: PhotonFeature[]): DestinationSuggestion[] {
    const seen = new Set<string>();
    const suggestions: DestinationSuggestion[] = [];
    for (const feature of features) {
      const name = feature.properties?.name;
      const coords = feature.geometry?.coordinates;
      if (!name || !coords || coords.length < 2) continue;
      
      const [longitude, latitude] = coords;
      if (typeof latitude !== "number" || typeof longitude !== "number") continue;

      const city = feature.properties?.city;
      const country = feature.properties?.country;
      const label = [name, city && city !== name ? city : null, country]
        .filter(Boolean)
        .join(", ");

      const key = label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      suggestions.push({ label, latitude, longitude });
      if (suggestions.length === DISPLAY_LIMIT) break;
    }
    return suggestions;
  }
}
