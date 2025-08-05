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
  IonChip,
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
  people,
  paw,
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
    IonChip,
  ],
})
export class FountainsListComponent implements OnInit, OnDestroy {
  @Input() fountains: Fountain[] = [];
  @Input() isFavoritesMode: boolean = false; // Para saber si es modo favoritos

  filteredFountains: Fountain[] = [];
  districts: string[] = [];
  searchTerm: string = '';
  selectedDistrict: string = '';
  selectedUsage: string = ''; // Nuevo filtro de uso

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
      people,
      paw,
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
    // Optimización: procesar distritos directamente sin chunks para datasets pequeños/medianos
    const uniqueDistricts = new Set<string>();

    // Para menos de 5000 fuentes, procesar directamente
    if (this.fountains.length < 5000) {
      this.fountains.forEach((fountain) => {
        if (fountain.DISTRITO) {
          uniqueDistricts.add(fountain.DISTRITO);
        }
      });

      this.districts = Array.from(uniqueDistricts).sort();
      this.setupInitialView();
      return;
    }

    // Para datasets muy grandes, mantener procesamiento por chunks
    const chunkSize = 500; // Aumentar tamaño del chunk
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
        // Usar requestAnimationFrame en lugar de setTimeout para mejor performance
        requestAnimationFrame(processChunk);
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
      // Para filtros de select (distrito), aplicar inmediatamente sin delay
      this.applyFilters();
    } else {
      // Para búsqueda por texto, mantener delay pequeño
      this.filterTimeout = setTimeout(() => {
        this.applyFilters();
      }, 150); // Reducido de 300ms a 150ms
    }
  }

  private applyFilters(): void {
    this.isLoading = true;

    // Para filtros simples como distrito y uso, ejecutar síncronamente
    if (
      (this.selectedDistrict || this.selectedUsage) &&
      !this.searchTerm.trim()
    ) {
      this.performFilter();
      return;
    }

    // Solo usar async para filtros complejos
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        this.performFilter();
      });
    } else {
      // Usar requestAnimationFrame en lugar de setTimeout
      requestAnimationFrame(() => {
        this.performFilter();
      });
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

    // Filtrar por uso seleccionado
    if (this.selectedUsage) {
      filtered = filtered.filter((fountain) => {
        const usage = this.getUsage(fountain);

        if (this.selectedUsage === 'personas') {
          return usage === 'Solo personas';
        } else if (this.selectedUsage === 'mascotas') {
          return usage === 'Personas y mascotas';
        }

        return true; // No debería llegar aquí con el filtro actual
      });
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
    this.selectedUsage = '';

    // Resetear estado de paginación
    this.currentPage = 1;
    this.hasMoreItems = true;

    // Aplicar filtros para mostrar todos los elementos
    this.filterFountains(true);

    // Simular evento de scroll para reestablecer la lista completa
    setTimeout(() => {
      this.triggerScrollReset();
    }, 100);
  }
  private triggerScrollReset(): void {
    // Reestablecer la vista inicial completa
    this.allFilteredResults = [...this.fountains];
    this.filteredFountains = this.fountains.slice(0, this.itemsPerPage);
    this.hasMoreItems = this.fountains.length > this.itemsPerPage;

    // Simular que se ha hecho scroll para cargar más elementos si es necesario
    if (this.hasMoreItems) {
      this.loadMoreItems();
    }

    console.log('🔄 Filtros limpiados y lista restablecida');
  }

  public hasActiveFilters(): boolean {
    return (
      this.searchTerm.trim() !== '' ||
      this.selectedDistrict !== '' ||
      this.selectedUsage !== ''
    );
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
          markerData: {
            distrito: fountain.DISTRITO,
            barrio: fountain.BARRIO,
            estado: fountain.ESTADO,
            uso: fountain.USO,
            fullData: fountain, // Pasar el objeto completo que incluye FECHA_INSTALACION
          },
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

  public getStatusColor(estado: string): string {
    const status = this.getStatusText(estado);
    switch (status) {
      case 'Funcionando':
        return 'success';
      case 'Fuera de servicio':
        return 'danger';
      case 'En mantenimiento':
        return 'warning';
      default:
        return 'medium';
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

  public getUsage(fountain: Fountain): string {
    if (!fountain.USO) return 'Uso no especificado';

    const usage = fountain.USO.toUpperCase().trim();

    if (
      usage.includes('PERSONAS_Y_MASCOTAS') ||
      usage.includes('PERSONAS Y MASCOTAS')
    ) {
      return 'Personas y mascotas';
    } else if (usage.includes('PERSONAS')) {
      return 'Solo personas';
    }

    return fountain.USO || 'Uso no especificado';
  }

  public getUsageIcon(fountain: Fountain): string {
    const usage = this.getUsage(fountain);
    if (usage === 'Personas y mascotas') {
      return 'paw';
    } else if (usage === 'Solo personas') {
      return 'people';
    }
    return 'help-circle';
  }

  public getUsageColor(fountain: Fountain): string {
    const usage = this.getUsage(fountain);
    if (usage === 'Personas y mascotas') {
      return 'secondary';
    } else if (usage === 'Solo personas') {
      return 'primary';
    }
    return 'medium';
  }
}
