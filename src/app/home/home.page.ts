import {
  Component,
  ElementRef,
  OnInit,
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
import { first } from 'rxjs';
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
export class HomePage implements OnInit {
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  map!: GoogleMap;

  myLocation: Marker = {} as Marker;
  watterLocations: Marker[] = [];
  watterData: Map<string, any> = new Map(); // Para almacenar la información de cada marcador
  loading = true;

  private readonly placesSvr = inject(PlacesWatterService);
  private readonly modalCtrl = inject(ModalController);

  ngOnInit(): void {
    this.getUserLocation();
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

  private callApiWatterLocationsAndMark() {
    this.placesSvr
      .getFountaingWatter()
      .pipe(first())
      .subscribe((data) => {
        data.records.forEach((item) => {
          const coordinateKey = `${item.LATITUD}-${item.LONGITUD}`;

          // Guardamos la información del marcador
          this.watterData.set(coordinateKey, {
            estado: item.ESTADO,
            distrito: item.DISTRITO,
            barrio: item.BARRIO,
            latitud: item.LATITUD,
            longitud: item.LONGITUD,
          });

          this.watterLocations.push({
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
          });
        });
        this.map.addMarkers(this.watterLocations);
        this.loading = false;
      });
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
