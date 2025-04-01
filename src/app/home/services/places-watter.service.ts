import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FountainData } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  constructor(private readonly http: HttpClient) {}

  public getFountaingWatter(): Observable<FountainData[]> {
    return this.http.get<FountainData[]>(
      'https://parakeet-concrete-foxhound.ngrok-free.app/fuentes_de_beber/'
    );
  }
}
