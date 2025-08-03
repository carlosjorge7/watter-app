import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Fountain {
  DISTRITO?: string;
  BARRIO?: string;
  ESTADO?: string;
  LATITUD?: number;
  LONGITUD?: number;
  id?: string; // Identificador único para cada fuente
}

@Injectable({
  providedIn: 'root',
})
export class FavoritesService {
  private readonly FAVORITES_KEY = 'aquamad_favorites';
  private favoritesSubject = new BehaviorSubject<Fountain[]>([]);

  // Observable público para que los componentes se suscriban
  public favorites$ = this.favoritesSubject.asObservable();

  constructor() {
    this.loadFavoritesFromStorage();
  }

  /**
   * Carga los favoritos desde localStorage
   */
  private loadFavoritesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.FAVORITES_KEY);
      if (stored) {
        const favorites: Fountain[] = JSON.parse(stored);
        this.favoritesSubject.next(favorites);
      }
    } catch (error) {
      console.error('Error loading favorites from localStorage:', error);
      this.favoritesSubject.next([]);
    }
  }

  /**
   * Guarda los favoritos en localStorage
   */
  private saveFavoritesToStorage(favorites: Fountain[]): void {
    try {
      localStorage.setItem(this.FAVORITES_KEY, JSON.stringify(favorites));
    } catch (error) {
      console.error('Error saving favorites to localStorage:', error);
    }
  }

  /**
   * Genera un ID único para una fuente basado en sus coordenadas
   */
  private generateFountainId(fountain: Fountain): string {
    return `${fountain.LATITUD}-${fountain.LONGITUD}`;
  }

  /**
   * Añade una fuente a favoritos
   */
  public addToFavorites(fountain: Fountain): void {
    const currentFavorites = this.favoritesSubject.getValue();
    const fountainId = this.generateFountainId(fountain);

    // Verificar si ya existe en favoritos
    const exists = currentFavorites.some(
      (fav) => this.generateFountainId(fav) === fountainId
    );

    if (!exists) {
      const fountainWithId = { ...fountain, id: fountainId };
      const updatedFavorites = [...currentFavorites, fountainWithId];

      this.favoritesSubject.next(updatedFavorites);
      this.saveFavoritesToStorage(updatedFavorites);
    }
  }

  /**
   * Elimina una fuente de favoritos
   */
  public removeFromFavorites(fountain: Fountain): void {
    const currentFavorites = this.favoritesSubject.getValue();
    const fountainId = this.generateFountainId(fountain);

    const updatedFavorites = currentFavorites.filter(
      (fav) => this.generateFountainId(fav) !== fountainId
    );

    this.favoritesSubject.next(updatedFavorites);
    this.saveFavoritesToStorage(updatedFavorites);
  }

  /**
   * Verifica si una fuente está en favoritos
   */
  public isFavorite(fountain: Fountain): Observable<boolean> {
    const fountainId = this.generateFountainId(fountain);
    return this.favorites$.pipe(
      map((favorites) =>
        favorites.some((fav) => this.generateFountainId(fav) === fountainId)
      )
    );
  }

  /**
   * Obtiene el número total de favoritos
   */
  public getFavoritesCount(): Observable<number> {
    return this.favorites$.pipe(map((favorites) => favorites.length));
  }

  /**
   * Alterna el estado de favorito de una fuente
   */
  public toggleFavorite(fountain: Fountain): void {
    const currentFavorites = this.favoritesSubject.getValue();
    const fountainId = this.generateFountainId(fountain);

    const exists = currentFavorites.some(
      (fav) => this.generateFountainId(fav) === fountainId
    );

    if (exists) {
      this.removeFromFavorites(fountain);
    } else {
      this.addToFavorites(fountain);
    }
  }
  /**
   * Limpia todos los favoritos
   */
  public clearAllFavorites(): void {
    this.favoritesSubject.next([]);
    this.saveFavoritesToStorage([]);
  }
}
