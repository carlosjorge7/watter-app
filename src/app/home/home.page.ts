import {
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { GoogleMap, Marker } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from 'src/environments/environment';
import { PlacesWatterService } from './services/places-watter.service';
import { ModalController } from '@ionic/angular';
import { InfoLocationComponent } from './info-location/info-location.component';
import { Cordenadas } from './models/models';
import { first } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  map!: GoogleMap;

  myLocation: Marker = {} as Marker;
  watterLocations: Marker[] = [];
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
    };
    this.map.addMarker(this.myLocation);
  }

  private callApiWatterLocationsAndMark() {
    this.placesSvr
      .getFountaingWatter()
      .pipe(first())
      .subscribe((data) => {
        data.forEach((item) => {
          this.watterLocations.push({
            coordinate: {
              lat: item.LATITUD,
              lng: item.LONGITUD,
            },
            title: `Estado: ${item.ESTADO}, Zona: ${item.DISTRITO}, Barrio: ${item.BARRIO}`,
          });
        });
        this.map.addMarkers(this.watterLocations);
        this.loading = false;
      });
  }

  private presentLocationDetail(): void {
    this.map.setOnMarkerClickListener(async (marker) => {
      const info = await this.modalCtrl.create({
        component: InfoLocationComponent,
        componentProps: { marker },
        breakpoints: [0, 0.5],
        initialBreakpoint: 0.5,
      });
      info.present();
    });
  }
}
