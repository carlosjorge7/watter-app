import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonIcon,
  IonContent,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonLabel,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { CommonModule, DecimalPipe, AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InfoLocationComponent } from '../info-location/info-location.component';
import { FavoritesService, Fountain } from '../services/favorites.service';
import { FuenteDTO } from '../models/models';
import { addIcons } from 'ionicons';
import { Subject, takeUntil, Observable } from 'rxjs';
import {
  water,
  close,
  location,
  map,
  share,
  search,
  checkmarkCircle,
  closeCircle,
  construct,
  helpCircle,
  list,
  heart,
  heartOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-fountains-list',
  templateUrl: './fountains-list.component.html',
  styleUrls: ['./fountains-list.component.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    AsyncPipe,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonIcon,
    IonContent,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonLabel,
    IonSpinner,
  ],
})
export class FountainsListComponent implements OnInit, OnDestroy {
  @Input() fountains: Fountain[] = [];
  @Input() isFavoritesMode: boolean = false; // Para saber si es modo favoritos

  filteredFountains: Fountain[] = [];
  districts: string[] = [];
  searchTerm: string = '';
  selectedDistrict: string = '';

  // Estados de carga y paginación
  isLoading = false;
  initialLoad = true;
  itemsPerPage = 50; // Mostrar solo 50 elementos inicialmente
  currentPage = 1;
  hasMoreItems = true;

  // Guardar el resultado completo del filtro para paginación
  public allFilteredResults: Fountain[] = [];

  // Para manejar debounce personalizado
  private filterTimeout: any;
  private destroy$ = new Subject<void>();
  private modalCtrl = inject(ModalController);
  private favoritesService = inject(FavoritesService);

  constructor() {
    addIcons({
      water,
      close,
      location,
      map,
      share,
      search,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      construct,
      'help-circle': helpCircle,
      list,
      heart,
      'heart-outline': heartOutline,
    });
  }

  ngOnInit() {
    this.setupDataOptimized();
  }
  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();

    // Limpiar timeout al destruir el componente
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }
  }

  private async setupDataOptimized(): Promise<void> {
    this.isLoading = true;

    // Usar requestIdleCallback para procesar datos cuando el navegador esté libre
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.processDataInChunks();
      });
    } else {
      // Fallback para navegadores que no soportan requestIdleCallback
      setTimeout(() => {
        this.processDataInChunks();
      }, 0);
    }
  }

  private processDataInChunks(): void {
    // Extraer distritos únicos de forma optimizada
    const uniqueDistricts = new Set<string>();

    // Procesar en chunks para no bloquear el UI
    const chunkSize = 100;
    let currentIndex = 0;

    const processChunk = () => {
      const endIndex = Math.min(
        currentIndex + chunkSize,
        this.fountains.length
      );

      for (let i = currentIndex; i < endIndex; i++) {
        const fountain = this.fountains[i];
        if (fountain.DISTRITO) {
          uniqueDistricts.add(fountain.DISTRITO);
        }
      }

      currentIndex = endIndex;

      if (currentIndex < this.fountains.length) {
        // Continuar procesando el siguiente chunk
        setTimeout(processChunk, 0);
      } else {
        // Finalizar procesamiento
        this.districts = Array.from(uniqueDistricts).sort();
        this.setupInitialView();
      }
    };

    processChunk();
  }

  private setupInitialView(): void {
    // Mostrar todos los elementos sin filtros inicialmente
    this.allFilteredResults = [...this.fountains];
    this.filteredFountains = this.fountains.slice(0, this.itemsPerPage);
    this.hasMoreItems = this.fountains.length > this.itemsPerPage;
    this.isLoading = false;
    this.initialLoad = false;

    console.log(
      `📊 Vista inicial: ${this.filteredFountains.length}/${this.fountains.length} fuentes, ${this.districts.length} distritos`
    );
  }

  public filterFountains(immediate: boolean = false): void {
    // Limpiar timeout anterior si existe
    if (this.filterTimeout) {
      clearTimeout(this.filterTimeout);
    }

    // Si ya hay una búsqueda en curso, no iniciar otra
    if (this.isLoading) return;

    if (immediate) {
      // Aplicar filtros inmediatamente (para selects)
      this.applyFilters();
    } else {
      // Aplicar filtro con pequeño delay para better UX (para búsqueda por texto)
      this.filterTimeout = setTimeout(() => {
        this.applyFilters();
      }, 300);
    }
  }

  private applyFilters(): void {
    this.isLoading = true;

    // Usar requestIdleCallback para filtros pesados
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.performFilter();
      });
    } else {
      setTimeout(() => {
        this.performFilter();
      }, 0);
    }
  }

  private performFilter(): void {
    let filtered = [...this.fountains];

    // Filtrar por término de búsqueda (búsqueda más amplia)
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter((fountain) => {
        const distrito = fountain.DISTRITO?.toLowerCase() || '';
        const barrio = fountain.BARRIO?.toLowerCase() || '';
        const estado = fountain.ESTADO?.toLowerCase() || '';

        // Buscar en múltiples campos
        return (
          distrito.includes(term) ||
          barrio.includes(term) ||
          estado.includes(term) ||
          // Búsqueda por coordenadas (útil para búsquedas específicas)
          fountain.LATITUD?.toString().includes(term) ||
          fountain.LONGITUD?.toString().includes(term)
        );
      });
    }

    // Filtrar por distrito seleccionado
    if (this.selectedDistrict) {
      filtered = filtered.filter(
        (fountain) => fountain.DISTRITO === this.selectedDistrict
      );
    }

    // Guardar todos los resultados filtrados
    this.allFilteredResults = filtered;

    // Resetear paginación y mostrar solo los primeros resultados
    this.currentPage = 1;
    this.filteredFountains = filtered.slice(0, this.itemsPerPage);
    this.hasMoreItems = filtered.length > this.itemsPerPage;
    this.isLoading = false;

    console.log(
      `🔍 Filtradas: ${filtered.length} fuentes (mostrando ${this.filteredFountains.length})`
    );
  }

  public loadMoreItems(): void {
    if (!this.hasMoreItems || this.isLoading) return;

    this.isLoading = true;

    // Simular carga asíncrona
    setTimeout(() => {
      const startIndex = this.currentPage * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      const newItems = this.allFilteredResults.slice(startIndex, endIndex);

      this.filteredFountains = [...this.filteredFountains, ...newItems];
      this.currentPage++;
      this.hasMoreItems = endIndex < this.allFilteredResults.length;
      this.isLoading = false;

      console.log(
        `📄 Cargada página ${this.currentPage}, total: ${this.filteredFountains.length}`
      );
    }, 100);
  }

  public onScroll(event: any): void {
    const scrollElement = event.target;
    const threshold = 100; // pixels desde el final para cargar más

    if (
      scrollElement.scrollTop + scrollElement.clientHeight >=
      scrollElement.scrollHeight - threshold
    ) {
      this.loadMoreItems();
    }
  }

  public clearFilters(): void {
    this.searchTerm = '';
    this.selectedDistrict = '';
    this.filterFountains(true);
  }

  public hasActiveFilters(): boolean {
    return this.searchTerm.trim() !== '' || this.selectedDistrict !== '';
  }

  public async closeModal(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  public async openFountainDetail(fountain: any): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InfoLocationComponent,
      componentProps: {
        marker: {
          latitude: fountain.LATITUD,
          longitude: fountain.LONGITUD,
          title: `Estado: ${fountain.ESTADO || 'No disponible'}, Zona: ${
            fountain.DISTRITO || 'No disponible'
          }, Barrio: ${fountain.BARRIO || 'No disponible'}`,
          markerData: fountain,
        },
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });

    await modal.present();
  }

  public async goToMap(fountain: any, event: Event): Promise<void> {
    event.stopPropagation();

    await this.modalCtrl.dismiss({
      action: 'goToMap',
      fountain: fountain,
    });
  }

  public async shareLocation(fountain: any, event: Event): Promise<void> {
    event.stopPropagation();

    try {
      const text = `Fuente de agua en ${fountain.DISTRITO}, ${fountain.BARRIO}: https://maps.google.com/maps?q=${fountain.LATITUD},${fountain.LONGITUD}`;

      if (navigator.share) {
        await navigator.share({
          title: 'Fuente de agua encontrada',
          text: text,
          url: `https://maps.google.com/maps?q=${fountain.LATITUD},${fountain.LONGITUD}`,
        });
      } else {
        await navigator.clipboard.writeText(text);
        console.log('Ubicación copiada al portapapeles');
      }
    } catch (error) {
      console.log('Error sharing:', error);
    }
  }

  public getStatusText(estado: string): string {
    if (!estado) return 'Estado desconocido';

    const status = estado.toUpperCase().trim();

    if (status.includes('FUNCIONANDO') || status.includes('OPERATIVO')) {
      return 'Funcionando';
    } else if (status.includes('FUERA') || status.includes('NO OPERATIVO')) {
      return 'Fuera de servicio';
    } else if (status.includes('MANTENIMIENTO')) {
      return 'En mantenimiento';
    }

    return estado;
  }

  public getStatusClass(estado: string): string {
    const status = this.getStatusText(estado);
    switch (status) {
      case 'Funcionando':
        return 'status-working';
      case 'Fuera de servicio':
        return 'status-broken';
      case 'En mantenimiento':
        return 'status-maintenance';
      default:
        return 'status-unknown';
    }
  }

  public getStatusIcon(estado: string): string {
    const status = this.getStatusText(estado);
    switch (status) {
      case 'Funcionando':
        return 'checkmark-circle';
      case 'Fuera de servicio':
        return 'close-circle';
      case 'En mantenimiento':
        return 'construct';
      default:
        return 'help-circle';
    }
  }

  public isFavorite(fountain: Fountain): Observable<boolean> {
    return this.favoritesService.isFavorite(fountain);
  }

  public toggleFavorite(fountain: Fountain, event: Event): void {
    event.stopPropagation();
    this.favoritesService.toggleFavorite(fountain);
  }

  public addToFavorites(fountain: Fountain, event: Event): void {
    event.stopPropagation();
    this.favoritesService.addToFavorites(fountain);
  }

  public removeFromFavorites(fountain: Fountain, event: Event): void {
    event.stopPropagation();
    this.favoritesService.removeFromFavorites(fountain);
  }
}
