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
import { ModalController } from '@ionic/angular/standalone';
import { InfoLocationComponent } from './info-location/info-location.component';
import { Cordenadas } from './models/models';
import { first, Subject, takeUntil } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonIcon,
  IonProgressBar,
  IonContent,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonIcon,
    IonProgressBar,
    IonContent,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  map!: GoogleMap;

  myLocation: Marker = {} as Marker;
  watterLocations: Marker[] = [];
  watterData: Map<string, any> = new Map(); // Para almacenar la información de cada marcador
  loading = true;
  loadingProgress = 0; // Para mostrar progreso de carga
  totalExpectedFountains = 2253; // Estimado total realista de fuentes (23 páginas * ~65 por página)
  showProgressBar = true; // Control separado para la barra de progreso

  // Subject para manejar la desuscripción
  private destroy$ = new Subject<void>();

  private readonly placesSvr = inject(PlacesWatterService);
  private readonly modalCtrl = inject(ModalController);

  ngOnInit(): void {
    this.getUserLocation();
  }

  ngOnDestroy(): void {
    // Completar el subject para desuscribir todos los observables
    this.destroy$.next();
    this.destroy$.complete();

    // Cancelar operaciones en curso del servicio (opcional)
    this.placesSvr.cancelCurrentOperations();

    console.log('🧹 Componente destruido y observables desuscritos');
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
      opacity: 0.5,
      iconSize: {
        width: 60,
        height: 60,
      },
    };
    this.map.addMarker(this.myLocation);
  }

  private callApiWatterLocationsAndMark(): void {
    // ESTRATEGIA 1: Carga progresiva
    console.log('🚀 Iniciando carga progresiva de fuentes...');

    // Cargar datos iniciales (primeras 3 páginas)
    this.placesSvr
      .getFountainsProgressive()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          console.log(
            `✅ Carga inicial: ${data.records.length} fuentes cargadas`
          );
          this.addMarkersToMap(data.records);
          this.updateLoadingProgress(data.records.length);

          // Solo ocultar el loading principal, mantener la barra de progreso
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error en carga inicial:', error);
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

  private addMarkersToMap(fountains: any[]): void {
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
      });

      const marker: Marker = {
        coordinate: {
          lat: item.LATITUD,
          lng: item.LONGITUD,
        },
        // Título vacío para que no se muestre en el mapa
        title: '',
        // Icono personalizado de gota de agua
        iconUrl:
          'data:image/svg+xml;base64,' +
          btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
              <path fill="#2196F3" d="M16 2c-4.418 0-8 7.164-8 12 0 4.418 3.582 8 8 8s8-3.582 8-8c0-4.836-3.582-12-8-12z"/>
              <path fill="#1976D2" d="M16 2c-2 0-4 3-6 6 0 0 2-2 6-2s6 2 6 2c-2-3-4-6-6-6z"/>
            </svg>
          `),
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
          ? `Estado: ${markerData.estado}, Zona: ${markerData.distrito}, Barrio: ${markerData.barrio}`
          : 'Información no disponible',
      };

      const info = await this.modalCtrl.create({
        component: InfoLocationComponent,
        componentProps: { marker: markerWithInfo },
        breakpoints: [0, 0.5],
        initialBreakpoint: 0.5,
      });
      info.present();
    });
  }
}
