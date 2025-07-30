import { Injectable } from '@angular/core';
import {
  Observable,
  forkJoin,
  map,
  BehaviorSubject,
  Subject,
  takeUntil,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FuentesDeAguaDTO } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  private readonly baseUrl =
    'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/mint_fuentes.json';
  private readonly totalPages = 23;

  // Cache y estado para carga progresiva
  private fountainsSubject = new BehaviorSubject<any[]>([]);
  public fountains$ = this.fountainsSubject.asObservable();
  private loadedPages = new Set<number>();
  private isLoading = false;

  // Subject para cancelar operaciones en curso (NO para OnDestroy)
  private cancelOperations$ = new Subject<void>();

  constructor(private readonly http: HttpClient) {}

  // Método para cancelar todas las operaciones en curso
  public cancelCurrentOperations(): void {
    this.cancelOperations$.next();
    this.isLoading = false;
    console.log('⏹️ Operaciones en curso canceladas');
  }

  // ESTRATEGIA 1: Carga inmediata + progresiva (RECOMENDADA para mapas)
  public getFountainsProgressive(): Observable<FuentesDeAguaDTO> {
    // Primero carga las 3 primeras páginas rápidamente
    const initialPages = [1, 2, 3];
    const initialRequests = initialPages.map((page) =>
      this.getFountaingWatterByPage(page)
    );

    return forkJoin(initialRequests).pipe(
      map((responses: FuentesDeAguaDTO[]) => {
        // Combinar las primeras páginas
        const initialRecords = responses.reduce((acc, response) => {
          return [...acc, ...response.records];
        }, [] as any[]);

        // Marcar páginas como cargadas
        initialPages.forEach((page) => this.loadedPages.add(page));

        // Actualizar el subject con los datos iniciales
        this.fountainsSubject.next(initialRecords);

        // Cargar el resto en segundo plano
        this.loadRemainingPagesInBackground();

        return {
          ...responses[0],
          records: initialRecords,
          totalRecords: initialRecords.length,
          isPartialLoad: true, // Indicar que hay más datos cargándose
        } as FuentesDeAguaDTO;
      })
    );
  }

  // Carga el resto de páginas en segundo plano
  private loadRemainingPagesInBackground(): void {
    if (this.isLoading) return;
    this.isLoading = true;

    const remainingPages = [];
    for (let page = 4; page <= this.totalPages; page++) {
      if (!this.loadedPages.has(page)) {
        remainingPages.push(page);
      }
    }

    // Cargar de 2 en 2 para no sobrecargar
    const batchSize = 2;
    const batches = [];

    for (let i = 0; i < remainingPages.length; i += batchSize) {
      batches.push(remainingPages.slice(i, i + batchSize));
    }

    // Procesar lotes secuencialmente
    this.processBatches(batches, 0);
  }

  private processBatches(batches: number[][], batchIndex: number): void {
    if (batchIndex >= batches.length) {
      this.isLoading = false;
      return;
    }

    const currentBatch = batches[batchIndex];
    const batchRequests = currentBatch.map((page) =>
      this.getFountaingWatterByPage(page)
    );

    forkJoin(batchRequests)
      .pipe(takeUntil(this.cancelOperations$))
      .subscribe({
        next: (responses: FuentesDeAguaDTO[]) => {
          // Agregar nuevos records a los existentes
          const currentFountains = this.fountainsSubject.value;
          const newRecords = responses.reduce((acc, response) => {
            return [...acc, ...response.records];
          }, [] as any[]);

          this.fountainsSubject.next([...currentFountains, ...newRecords]);

          // Marcar páginas como cargadas
          currentBatch.forEach((page) => this.loadedPages.add(page));

          // Procesar siguiente lote con delay
          setTimeout(() => {
            this.processBatches(batches, batchIndex + 1);
          }, 500); // 500ms entre lotes
        },
        error: (error) => {
          console.error(`Error loading batch ${batchIndex}:`, error);
          // Continuar con el siguiente lote aunque falle uno
          setTimeout(() => {
            this.processBatches(batches, batchIndex + 1);
          }, 1000);
        },
      });
  }

  // Método adicional para obtener una página específica si es necesario
  public getFountaingWatterByPage(page: number): Observable<FuentesDeAguaDTO> {
    return this.http.get<FuentesDeAguaDTO>(`${this.baseUrl}?page=${page}`);
  }

  // Método para reiniciar el cache
  public resetCache(): void {
    this.cancelCurrentOperations(); // Cancelar operaciones primero
    this.fountainsSubject.next([]);
    this.loadedPages.clear();
    this.isLoading = false;
    console.log('🗑️ Cache del servicio reiniciado');
  }

  // Método para limpiar recursos cuando no se necesiten más
  public cleanup(): void {
    this.cancelCurrentOperations();
    this.resetCache();
    console.log('🧹 Recursos del servicio limpiados');
  }
}
