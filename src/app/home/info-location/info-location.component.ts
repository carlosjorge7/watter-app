import { Component, Input } from '@angular/core';
import { Browser } from '@capacitor/browser';

@Component({
  selector: 'app-info-location',
  templateUrl: './info-location.component.html',
  styleUrls: ['./info-location.component.scss'],
})
export class InfoLocationComponent {
  @Input() marker!: any;

  public async goGoogleMaps(): Promise<void> {
    const mapsUrl = `https://www.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`;
    await Browser.open({ url: mapsUrl });
  }
}
