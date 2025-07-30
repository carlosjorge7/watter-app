import { Component, Input } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonIcon,
  IonContent,
  IonButton,
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-info-location',
  templateUrl: './info-location.component.html',
  styleUrls: ['./info-location.component.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonIcon, IonContent, IonButton],
})
export class InfoLocationComponent {
  @Input() marker!: any;

  public async goGoogleMaps(): Promise<void> {
    const mapsUrl = `https://maps.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`;
    await Browser.open({ url: mapsUrl });
  }
}
