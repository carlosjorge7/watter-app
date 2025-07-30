import { Injectable } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FuentesDeAguaDTO } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  private readonly baseUrl =
    'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/mint_fuentes.json';
  private readonly totalPages = 23; // Total de páginas disponibles

  constructor(private readonly http: HttpClient) {}

  public getFountaingWatter(): Observable<FuentesDeAguaDTO> {
    // Crear un array de observables para cada página
    const pageRequests: Observable<FuentesDeAguaDTO>[] = [];

    for (let page = 1; page <= this.totalPages; page++) {
      const url = `${this.baseUrl}?page=${page}`;
      pageRequests.push(this.http.get<FuentesDeAguaDTO>(url));
    }

    // Ejecutar todas las peticiones en paralelo y combinar los resultados
    return forkJoin(pageRequests).pipe(
      map((responses: FuentesDeAguaDTO[]) => {
        // Combinar todos los records de todas las páginas
        const allRecords = responses.reduce((acc, response) => {
          return [...acc, ...response.records];
        }, [] as any[]);

        // Retornar un objeto con la estructura esperada
        return {
          ...responses[0], // Mantener la estructura del primer response
          records: allRecords,
          totalRecords: allRecords.length,
        } as FuentesDeAguaDTO;
      })
    );
  }

  // Método adicional para obtener una página específica si es necesario
  public getFountaingWatterByPage(page: number): Observable<FuentesDeAguaDTO> {
    return this.http.get<FuentesDeAguaDTO>(`${this.baseUrl}?page=${page}`);
  }
}
