import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Cordenadas, FountainData } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  constructor(private readonly http: HttpClient) {}

  public getFountaingWatter(): Observable<Cordenadas[]> {
    return this.http
      .get<FountainData[]>('http://127.0.0.1:8000/fuentes_de_beber/')
      .pipe(
        map((data: FountainData[]) => {
          return data.map((item: FountainData) => ({
            latitud: item.LATITUD,
            longitud: item.LONGITUD,
          }));
        })
      );
  }
}
