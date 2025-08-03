import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  inject,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from 'src/environments/environment';
import { PlacesWatterService } from './services/places-watter.service';
import { FavoritesService } from './services/favorites.service';
import {
  ModalController,
  ActionSheetController,
} from '@ionic/angular/standalone';
import { InfoLocationComponent } from './info-location/info-location.component';
import { Cordenadas, FuenteDTO, FuentesDeAguaDTO } from './models/models';
import { Subject, takeUntil, Observable, firstValueFrom } from 'rxjs';

// Interface para los datos del marcador con propiedades normalizadas
interface MarkerData {
  estado: string;
  distrito: string;
  barrio: string;
  latitud: number;
  longitud: number;
  uso: string;
  fullData: FuenteDTO;
}

// Interface extendida para la respuesta con información de caché
interface FuentesResponse extends FuentesDeAguaDTO {
  isFromCache?: boolean;
  isPartialLoad?: boolean;
}
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonIcon,
  IonProgressBar,
  IonContent,
  IonFab,
  IonFabButton,
  IonLabel,
  IonBadge,
  IonMenu,
  IonButtons,
  IonMenuButton,
  IonList,
  IonItem,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { FountainsListComponent } from './fountains-list/fountains-list.component';
import { addIcons } from 'ionicons';
import {
  list,
  locate,
  water,
  heart,
  analytics,
  settings,
  informationCircle,
  bug,
  share,
  apps,
  close,
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonIcon,
    IonProgressBar,
    IonContent,
    IonFab,
    IonFabButton,
    IonLabel,
    IonBadge,
    IonMenu,
    IonButtons,
    IonMenuButton,
    IonList,
    IonItem,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  map!: GoogleMap;
  myLocation: Marker = {} as Marker;
  watterLocations: Marker[] = [];
  watterData: Map<string, MarkerData> = new Map(); // Para almacenar la información de cada marcador
  loading = true;
  loadingProgress = 0; // Para mostrar progreso de carga
  totalExpectedFountains = 2558; // Estimado total realista de fuentes (23 páginas * ~65 por página)
  showProgressBar = true; // Control separado para la barra de progreso
  showInfoTooltip = false; // Controlar visibilidad del tooltip (inicialmente oculto)

  // Propiedades para favoritos
  public favoritesCount$!: Observable<number>;

  private destroy$ = new Subject<void>();

  private readonly placesSvr = inject(PlacesWatterService);
  private readonly modalCtrl = inject(ModalController);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly favoritesService = inject(FavoritesService);

  ngOnInit(): void {
    this.favoritesCount$ = this.favoritesService.getFavoritesCount();
    this.getUserLocation();

    if (!environment.production) {
      (window as any).homePage = this;
    }
  }

  constructor() {
    addIcons({
      list,
      locate,
      water,
      heart,
      analytics,
      settings,
      'information-circle': informationCircle,
      bug,
      share,
      apps,
      close,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.placesSvr.cancelCurrentOperations();
  }

  private async getUserLocation(): Promise<void> {
    const location = await Geolocation.getCurrentPosition();
    const userCordenadas = {
      latitud: location.coords.latitude,
      longitud: location.coords.longitude,
    } as Cordenadas;
    this.createMap(userCordenadas);
  }

  private async createMap(cordenadas: Cordenadas): Promise<void> {
    const { latitud, longitud } = cordenadas;
    this.map = await GoogleMap.create({
      id: 'my-cool-map',
      element: this.mapRef.nativeElement,
      apiKey: environment.MAP_KEY,
      forceCreate: true,
      config: {
        center: {
          lat: latitud,
          lng: longitud,
        },
        zoom: 14,
      },
    });
    this.getUserLocationAndMark(cordenadas);
    this.callApiWatterLocationsAndMark();
    this.presentLocationDetail();
  }

  private getUserLocationAndMark(cordenadas: Cordenadas): void {
    this.myLocation = {
      coordinate: {
        lat: cordenadas.latitud,
        lng: cordenadas.longitud,
      },
      title: 'Mi Ubicación',
      iconSize: {
        width: 60,
        height: 60,
      },
    };
    this.map.addMarker(this.myLocation);
  }

  private callApiWatterLocationsAndMark(): void {
    this.placesSvr
      .getFountainsProgressive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: FuentesResponse) => {
          this.addMarkersToMap(data.records);
          this.updateLoadingProgress(data.records.length);
          this.loading = false;
          this.showTooltipTemporarily();
        },
        error: () => {
          this.loading = false;
          this.showProgressBar = false;
        },
      });

    // Suscribirse a actualizaciones progresivas en segundo plano
    this.placesSvr.fountains$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (fountains) => {
        if (fountains.length > this.watterLocations.length) {
          console.log(
            `🔄 Actualización progresiva: ${fountains.length} fuentes totales`
          );
          const newFountains = fountains.slice(this.watterLocations.length);
          this.addMarkersToMap(newFountains);
          this.updateLoadingProgress(fountains.length);
        }
      },
      error: (error) => {
        console.error('❌ Error en carga progresiva:', error);
        this.showProgressBar = false;
      },
    });
  }

  private addMarkersToMap(fountains: FuenteDTO[]): void {
    const newMarkers: Marker[] = [];

    fountains.forEach((item) => {
      const coordinateKey = `${item.LATITUD}-${item.LONGITUD}`;

      // Evitar duplicados
      if (this.watterData.has(coordinateKey)) {
        return;
      }

      // Guardamos la información del marcador
      this.watterData.set(coordinateKey, {
        estado: item.ESTADO,
        distrito: item.DISTRITO,
        barrio: item.BARRIO,
        latitud: item.LATITUD,
        longitud: item.LONGITUD,
        uso: item.USO,
        // Guardamos también el objeto completo para acceso fácil
        fullData: item,
      });

      // Determinar el icono según el uso
      const isForPetsAndPeople =
        item.USO &&
        (item.USO.toUpperCase().includes('PERSONAS_Y_MASCOTAS') ||
          item.USO.toUpperCase().includes('PERSONAS Y MASCOTAS'));

      const iconSvg = isForPetsAndPeople
        ? // Huella de perro para personas y mascotas
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
             <g fill="#333333">
               <!-- Almohadilla principal -->
               <ellipse cx="16" cy="20" rx="6" ry="4"/>
               <!-- Dedos superiores -->
               <ellipse cx="10" cy="12" rx="2.5" ry="3"/>
               <ellipse cx="16" cy="10" rx="2.5" ry="3"/>
               <ellipse cx="22" cy="12" rx="2.5" ry="3"/>
               <!-- Dedo lateral mejorado -->
               <ellipse cx="24.5" cy="17" rx="1.8" ry="2.8" fill="#2D2D2D" transform="rotate(20 24.5 17)"/>
               <ellipse cx="24.7" cy="16.8" rx="1.2" ry="2.1" fill="#1A1A1A" transform="rotate(20 24.7 16.8)"/>
             </g>
           </svg>`
        : // Gota de agua para solo personas
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
             <path fill="#2196F3" d="M16 2c-4.418 0-8 7.164-8 12 0 4.418 3.582 8 8 8s8-3.582 8-8c0-4.836-3.582-12-8-12z"/>
             <path fill="#1976D2" d="M16 2c-2 0-4 3-6 6 0 0 2-2 6-2s6 2 6 2c-2-3-4-6-6-6z"/>
           </svg>`;

      const marker: Marker = {
        coordinate: {
          lat: item.LATITUD,
          lng: item.LONGITUD,
        },
        // Título vacío para que no se muestre en el mapa
        title: '',
        // Icono personalizado según el uso
        iconUrl: 'data:image/svg+xml;base64,' + btoa(iconSvg),
        iconSize: {
          width: 38,
          height: 38,
        },
      };

      newMarkers.push(marker);
      this.watterLocations.push(marker);
    });

    // Agregar nuevos marcadores al mapa
    if (newMarkers.length > 0) {
      this.map.addMarkers(newMarkers);
      console.log(
        `📍 Agregados ${newMarkers.length} nuevos marcadores al mapa`
      );
    }
  }

  private updateLoadingProgress(currentCount: number): void {
    // Calcular progreso basado en el total estimado
    this.loadingProgress = Math.min(
      (currentCount / this.totalExpectedFountains) * 100,
      100
    );

    console.log(
      `📊 Progreso: ${this.loadingProgress.toFixed(1)}% (${currentCount}/${
        this.totalExpectedFountains
      })`
    );

    // Ocultar barra de progreso cuando esté completa o cerca
    if (
      this.loadingProgress >= 98 ||
      currentCount >= this.totalExpectedFountains
    ) {
      setTimeout(() => {
        this.showProgressBar = false;
        console.log('🎉 Carga completa de todas las fuentes!');
      }, 1000); // Esperar 1 segundo antes de ocultar para que el usuario vea el 100%
    }
  }

  private presentLocationDetail(): void {
    this.map.setOnMarkerClickListener(async (marker) => {
      // Buscar la información del marcador usando las coordenadas
      const coordinateKey = `${marker.latitude}-${marker.longitude}`;
      const markerData = this.watterData.get(coordinateKey);

      // Crear un objeto marker con la información completa para el modal
      const markerWithInfo = {
        ...marker,
        title: markerData
          ? `Estado: ${markerData.estado || 'No disponible'}, Zona: ${
              markerData.distrito || 'No disponible'
            }, Barrio: ${markerData.barrio || 'No disponible'}`
          : 'Información no disponible',
        // Pasar toda la información disponible
        markerData: markerData || null,
      };

      const info = await this.modalCtrl.create({
        component: InfoLocationComponent,
        componentProps: { marker: markerWithInfo },
        breakpoints: [0, 1],
        initialBreakpoint: 1,
      });
      info.present();
    });
  }

  public async openFountainsList(): Promise<void> {
    try {
      console.log(`📋 Abriendo listado de fuentes...`);

      // Usar directamente el servicio para obtener las fuentes cacheadas
      const cachedFountains = this.placesSvr.getCachedFountains();

      const modal = await this.modalCtrl.create({
        component: FountainsListComponent,
        componentProps: {
          fountains: cachedFountains,
        },
        breakpoints: [0, 1],
        initialBreakpoint: 1,
        backdropDismiss: true,
        showBackdrop: true,
      });

      await modal.present();

      // Manejar el resultado del modal
      const { data } = await modal.onDidDismiss();

      if (data?.action === 'goToMap' && data?.fountain) {
        // Centrar el mapa en la fuente seleccionada
        await this.centerOnLocation(
          data.fountain.LATITUD,
          data.fountain.LONGITUD
        );
        console.log(`🎯 Centrando mapa en fuente: ${data.fountain.DISTRITO}`);
      }
    } catch (error) {
      console.error('❌ Error abriendo listado de fuentes:', error);
    }
  }

  public async openFavoritesList(): Promise<void> {
    try {
      console.log('💖 Abriendo listado de fuentes favoritas...');

      // Obtener las fuentes favoritas usando firstValueFrom (reemplazo moderno de toPromise)
      const favorites = await firstValueFrom(
        this.favoritesService.favorites$.pipe(takeUntil(this.destroy$))
      );

      console.log('📝 Favoritos encontrados:', favorites.length);

      if (!favorites || favorites.length === 0) {
        console.log('📝 No hay fuentes favoritas guardadas');
        return;
      }

      const modal = await this.modalCtrl.create({
        component: FountainsListComponent,
        componentProps: {
          fountains: favorites,
          isFavoritesMode: true, // Indicar que es modo favoritos
        },
        breakpoints: [0, 1],
        initialBreakpoint: 1,
        backdropDismiss: true,
        showBackdrop: true,
      });

      await modal.present();

      const { data } = await modal.onWillDismiss();
      if (data?.action === 'goToMap' && data.fountain) {
        await this.centerOnLocation(
          data.fountain.LATITUD,
          data.fountain.LONGITUD
        );
        console.log(
          `🎯 Centrando mapa en fuente favorita: ${data.fountain.DISTRITO}`
        );
      }
    } catch (error) {
      console.error('❌ Error abriendo listado de favoritos:', error);
    }
  }

  public async centerOnMyLocation(): Promise<void> {
    try {
      console.log('📍 Centrando mapa en ubicación del usuario...');
      const location = await Geolocation.getCurrentPosition();

      await this.map.setCamera({
        coordinate: {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
        zoom: 16,
        animate: true,
      });

      console.log('✅ Mapa centrado en ubicación del usuario');
    } catch (error) {
      console.error('❌ Error centrando en ubicación del usuario:', error);
    }
  }

  /**
   * Centra el mapa en una ubicación específica
   */
  private async centerOnLocation(lat: number, lng: number): Promise<void> {
    try {
      await this.map.setCamera({
        coordinate: { lat, lng },
        zoom: 18,
        animate: true,
      });
    } catch (error) {
      console.error('❌ Error centrando mapa en ubicación:', error);
    }
  }

  public hideTooltip(): void {
    this.showInfoTooltip = false;
  }

  public async openActionsMenu(): Promise<void> {
    const favoritesCount = await firstValueFrom(this.favoritesCount$);

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Acciones disponibles',
      cssClass: 'custom-action-sheet',
      buttons: [
        {
          text: `Ver listado completo`,
          icon: 'list',
          handler: () => {
            this.openFountainsList();
          },
        },
        {
          text: `Favoritos ${favoritesCount > 0 ? `(${favoritesCount})` : ''}`,
          icon: 'heart',
          handler: () => {
            this.openFavoritesList();
          },
        },
        {
          text: 'Centrar en mi ubicación',
          icon: 'locate',
          handler: () => {
            this.centerOnMyLocation();
          },
        },
        {
          text: 'Estadísticas',
          icon: 'analytics',
          handler: () => {
            this.showCacheInfo();
          },
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  private showTooltipTemporarily(): void {
    this.showInfoTooltip = true;

    setTimeout(() => {
      this.showInfoTooltip = false;
    }, 5000);
  }

  // Métodos del menú
  public openStatistics(): void {
    this.showCacheInfo();
  }

  public openSettings(): void {
    // TODO: Implementar modal de configuración
  }

  public openAbout(): void {
    // TODO: Implementar modal de información
  }

  public reportIssue(): void {
    // TODO: Implementar funcionalidad de reporte de problemas
  }

  public shareApp(): void {
    // TODO: Implementar funcionalidad de compartir
  }

  // ========== MÉTODOS DE GESTIÓN DE CACHÉ ==========

  /**
   * Muestra información detallada del caché
   */
  public showCacheInfo(): void {
    const cacheInfo = this.placesSvr.getCacheInfo();
    const cacheAge = cacheInfo.cacheAge
      ? this.formatCacheAge(cacheInfo.cacheAge)
      : 'N/A';

    console.log('💾 INFORMACIÓN DEL CACHÉ:', {
      'Tiene caché válido': cacheInfo.hasCache ? '✅' : '❌',
      'Datos actuales desde caché': cacheInfo.isFromCache ? '✅' : '❌',
      'Todas las páginas cargadas': cacheInfo.allPagesLoaded ? '✅' : '❌',
      'Total de fuentes': cacheInfo.totalFountains,
      'Edad del caché': cacheAge,
    });

    // También mostrar en la consola para debug
    console.table({
      'Caché válido': cacheInfo.hasCache,
      'Desde caché': cacheInfo.isFromCache,
      'Páginas completas': cacheInfo.allPagesLoaded,
      'Total fuentes': cacheInfo.totalFountains,
      Edad: cacheAge,
    });
  }

  /**
   * Muestra opciones para gestionar el caché
   */
  public showCacheOptions(): void {
    const cacheInfo = this.placesSvr.getCacheInfo();

    console.log('⚙️ OPCIONES DE CACHÉ DISPONIBLES:');
    console.log('1. clearAllCache() - Limpiar todo el caché');
    console.log('2. forceRefreshFromAPI() - Forzar recarga desde API');
    console.log('3. getCacheInfo() - Ver información del caché');
    console.log('');
    console.log('Estado actual:', {
      'Fuentes en memoria': cacheInfo.totalFountains,
      'Desde caché': cacheInfo.isFromCache ? 'Sí' : 'No',
      'Caché válido': cacheInfo.hasCache ? 'Sí' : 'No',
    });

    // Ejemplos de uso:
    console.log('');
    console.log('Para usar desde la consola:');
    console.log('- Limpiar caché: window.homePage.clearCache()');
    console.log('- Recargar desde API: window.homePage.refreshFromAPI()');
    console.log('- Ver info: window.homePage.showCacheInfo()');
  }

  /**
   * Limpia todo el caché (memoria + localStorage)
   */
  public clearCache(): void {
    console.log('🗑️ Limpiando todo el caché...');
    this.placesSvr.clearAllCache();

    // Recargar la página para aplicar cambios
    setTimeout(() => {
      console.log('🔄 Recargando datos...');
      this.callApiWatterLocationsAndMark();
    }, 500);
  }

  /**
   * Fuerza la recarga desde la API ignorando el caché
   */
  public refreshFromAPI(): void {
    console.log('🌐 Forzando recarga desde API...');
    this.loading = true;
    this.showProgressBar = true;

    this.placesSvr
      .forceRefreshFromAPI()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data: FuentesResponse) => {
          console.log(
            `✅ Recarga forzada completada: ${data.records.length} fuentes`
          );
          this.addMarkersToMap(data.records);
          this.updateLoadingProgress(data.records.length);
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error en recarga forzada:', error);
          this.loading = false;
          this.showProgressBar = false;
        },
      });
  }

  /**
   * Formatea la edad del caché en un formato legible
   */
  private formatCacheAge(ageInMs: number): string {
    const seconds = Math.floor(ageInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} día${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hora${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minuto${minutes > 1 ? 's' : ''}`;
    return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
  }
}
