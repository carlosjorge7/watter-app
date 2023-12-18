import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  private readonly http = inject(HttpClient);

  public getFountaingWatter(lat: number, lon: number): Observable<any> {
    const placesEndpoint =
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
    const params = {
      location: `${lat},${lon}`,
      radius: 5000, // Radio de búsqueda en metros (ajústalo según tus necesidades)
      type: 'water',
      keyword: 'potable water',
      key: environment.MAP_KEY,
    };
    return this.http.get(placesEndpoint, { params });
  }
}
