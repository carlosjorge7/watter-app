import { Injectable } from '@angular/core';
import {
  Observable,
  forkJoin,
  map,
  BehaviorSubject,
  Subject,
  takeUntil,
  of,
} from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { FuentesDeAguaDTO, FuenteDTO } from '../models/models';

interface CacheData {
  fountains: FuenteDTO[];
  timestamp: number;
  totalRecords: number;
  version: string;
}

@Injectable({
  providedIn: 'root',
})
export class PlacesWatterService {
  private readonly baseUrl =
    'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/mint_fuentes.json';

  private readonly baseUrlFuentesMascotas =
    'https://ciudadesabiertas.madrid.es/dynamicAPI/API/query/min_fuentes_can.json?pageSize=4500&page=1';

  private readonly totalPages = 23;
  private readonly CACHE_KEY = 'watter_app_fountains_cache';
  private readonly CACHE_VERSION = '1.0.0';
  private readonly CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;

  private fountainsSubject = new BehaviorSubject<FuenteDTO[]>([]);
  public fountains$ = this.fountainsSubject.asObservable();
  private loadedPages = new Set<number>();
  private isLoading = false;
  private isDataFromCache = false;
  private allPagesLoaded = false;
  private cancelOperations$ = new Subject<void>();

  constructor(private readonly http: HttpClient) {
    this.loadFromCache();
  }

  private loadFromCache(): void {
    try {
      const cachedDataStr = localStorage.getItem(this.CACHE_KEY);
      if (!cachedDataStr) return;

      const cachedData: CacheData = JSON.parse(cachedDataStr);

      if (!this.isCacheValid(cachedData)) {
        this.clearPersistentCache();
        return;
      }

      this.fountainsSubject.next(cachedData.fountains);
      this.isDataFromCache = true;
      this.allPagesLoaded = true;

      for (let i = 1; i <= this.totalPages; i++) {
        this.loadedPages.add(i);
      }
    } catch (error) {
      this.clearPersistentCache();
    }
  }

  /**
   * Verifica si el caché es válido (versión correcta y no expirado)
   */
  private isCacheValid(cachedData: CacheData): boolean {
    if (!cachedData.version || cachedData.version !== this.CACHE_VERSION) {
      return false;
    }

    const cacheAge = Date.now() - cachedData.timestamp;
    return cacheAge < this.CACHE_DURATION;
  }

  private saveToCache(fountains: FuenteDTO[]): void {
    try {
      const cacheData: CacheData = {
        fountains,
        timestamp: Date.now(),
        totalRecords: fountains.length,
        version: this.CACHE_VERSION,
      };

      localStorage.setItem(this.CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      this.clearPersistentCache();
    }
  }

  private clearPersistentCache(): void {
    try {
      localStorage.removeItem(this.CACHE_KEY);
    } catch (error) {
      // Silent fail
    }
  }

  /**
   * Obtiene información sobre el estado del caché
   */
  public getCacheInfo(): {
    hasCache: boolean;
    isFromCache: boolean;
    cacheAge?: number;
    totalFountains: number;
    allPagesLoaded: boolean;
  } {
    const cachedDataStr = localStorage.getItem(this.CACHE_KEY);
    const currentFountains = this.fountainsSubject.value;

    let hasCache = false;
    let cacheAge: number | undefined;

    if (cachedDataStr) {
      try {
        const cachedData: CacheData = JSON.parse(cachedDataStr);
        hasCache = this.isCacheValid(cachedData);
        cacheAge = Date.now() - cachedData.timestamp;
      } catch (error) {
        hasCache = false;
      }
    }

    return {
      hasCache,
      isFromCache: this.isDataFromCache,
      cacheAge,
      totalFountains: currentFountains.length,
      allPagesLoaded: this.allPagesLoaded,
    };
  }

  public cancelCurrentOperations(): void {
    this.cancelOperations$.next();
    this.isLoading = false;
  }

  // ESTRATEGIA 1: Carga inmediata + progresiva (RECOMENDADA para mapas)
  public getFountainsProgressive(): Observable<FuentesDeAguaDTO> {
    if (this.isDataFromCache && this.allPagesLoaded) {
      const cachedFountains = this.fountainsSubject.value;

      return of({
        page: 1,
        pageSize: cachedFountains.length,
        totalRecords: cachedFountains.length,
        pageRecords: cachedFountains.length,
        status: 200,
        responseDate: new Date().toISOString(),
        first: '',
        last: '',
        next: '',
        self: '',
        contentMD5: '',
        sinEntrecomillar: true,
        records: cachedFountains,
        isPartialLoad: false,
        isFromCache: true,
      } as FuentesDeAguaDTO & { isFromCache: boolean; isPartialLoad: boolean });
    }

    const initialPages = [1, 2, 3];
    const initialRequests = initialPages.map((page) =>
      this.getFountaingWatterByPage(page)
    );

    // Agregar la petición de fuentes para mascotas
    const petsRequest = this.getFountainsPets();
    const allInitialRequests = [...initialRequests, petsRequest];

    return forkJoin(allInitialRequests).pipe(
      map((responses: FuentesDeAguaDTO[]) => {
        const initialRecords = responses.reduce((acc, response) => {
          return [...acc, ...response.records];
        }, [] as FuenteDTO[]);

        initialPages.forEach((page) => this.loadedPages.add(page));
        this.fountainsSubject.next(initialRecords);
        this.loadRemainingPagesInBackground();

        return {
          ...responses[0],
          records: initialRecords,
          totalRecords: initialRecords.length,
          isPartialLoad: true,
          isFromCache: false,
        } as FuentesDeAguaDTO & {
          isFromCache: boolean;
          isPartialLoad: boolean;
        };
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

    const batchSize = 2;
    const batches = [];

    for (let i = 0; i < remainingPages.length; i += batchSize) {
      batches.push(remainingPages.slice(i, i + batchSize));
    }

    this.processBatches(batches, 0);
  }

  private processBatches(batches: number[][], batchIndex: number): void {
    if (batchIndex >= batches.length) {
      this.isLoading = false;
      this.allPagesLoaded = true;

      // Agregar fuentes de mascotas al final
      this.getFountainsPets().subscribe({
        next: (petsResponse) => {
          const currentFountains = this.fountainsSubject.value;
          const allFountains = [...currentFountains, ...petsResponse.records];
          this.fountainsSubject.next(allFountains);

          if (allFountains.length > 0) {
            this.saveToCache(allFountains);
          }
        },
        error: () => {
          // Si falla la carga de mascotas, guardar solo las fuentes normales
          const allFountains = this.fountainsSubject.value;
          if (allFountains.length > 0) {
            this.saveToCache(allFountains);
          }
        },
      });
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
          const currentFountains = this.fountainsSubject.value;
          const newRecords = responses.reduce((acc, response) => {
            return [...acc, ...response.records];
          }, [] as FuenteDTO[]);

          this.fountainsSubject.next([...currentFountains, ...newRecords]);
          currentBatch.forEach((page) => this.loadedPages.add(page));

          setTimeout(() => {
            this.processBatches(batches, batchIndex + 1);
          }, 500);
        },
        error: () => {
          setTimeout(() => {
            this.processBatches(batches, batchIndex + 1);
          }, 1000);
        },
      });
  }

  public getFountaingWatterByPage(page: number): Observable<FuentesDeAguaDTO> {
    return this.http.get<FuentesDeAguaDTO>(`${this.baseUrl}?page=${page}`);
  }

  public getFountainsPets(): Observable<FuentesDeAguaDTO> {
    return this.http.get<FuentesDeAguaDTO>(this.baseUrlFuentesMascotas);
  }

  public getCachedFountains(): FuenteDTO[] {
    return this.fountainsSubject.value || [];
  }

  public resetCache(): void {
    this.cancelCurrentOperations();
    this.fountainsSubject.next([]);
    this.loadedPages.clear();
    this.isLoading = false;
    this.isDataFromCache = false;
    this.allPagesLoaded = false;
  }

  public clearAllCache(): void {
    this.resetCache();
    this.clearPersistentCache();
  }

  public forceRefreshFromAPI(): Observable<FuentesDeAguaDTO> {
    this.clearAllCache();
    this.isDataFromCache = false;
    this.allPagesLoaded = false;
    return this.getFountainsProgressive();
  }

  public cleanup(): void {
    this.cancelCurrentOperations();
    this.resetCache();
  }
}
