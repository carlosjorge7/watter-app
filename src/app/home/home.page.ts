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

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  @ViewChild('map') mapRef!: ElementRef<HTMLElement>;
  newMap!: GoogleMap;

  latitud = 0;
  longitud = 0;

  private readonly placesSvr = inject(PlacesWatterService);

  ngOnInit(): void {
    this.getLocation();
  }

  async getLocation() {
    const location = await Geolocation.getCurrentPosition();
    console.log(location);
    this.latitud = location.coords.latitude;
    this.longitud = location.coords.longitude;

    console.log(this.latitud, this.longitud);

    // Luego de obtener la ubicación, crea el mapa
    this.createMap(this.latitud, this.longitud);
  }

  async createMap(lat: number, lng: number) {
    this.newMap = await GoogleMap.create({
      id: 'my-cool-map',
      element: this.mapRef.nativeElement,
      apiKey: environment.MAP_KEY,
      forceCreate: true,
      config: {
        center: {
          lat: lat,
          lng: lng,
        },
        zoom: 14,
      },
    });

    const marker: Marker = {
      coordinate: {
        lat: lat,
        lng: lng,
      },
      title: 'Mi Ubicación',
      iconUrl: 'assets/location-sharp.svg',
      iconSize: { width: 30, height: 30 },
    };
    this.newMap.addMarker(marker);

    this.placesSvr
      .getFountaingWatter(lat, lng)
      .subscribe((res) => console.log(res));
  }
}
