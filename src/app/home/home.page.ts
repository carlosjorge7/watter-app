import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { GoogleMap } from '@capacitor/google-maps';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from 'src/environments/environment';

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

  ngOnInit(): void {
    this.getLocation();
  }

  async getLocation() {
    const location = await Geolocation.getCurrentPosition();
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
        zoom: 8,
      },
    });
  }
}
