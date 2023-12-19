import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-info-location',
  templateUrl: './info-location.component.html',
  styleUrls: ['./info-location.component.scss'],
})
export class InfoLocationComponent {
  @Input() marker!: any;

  public goGoogleMaps(): void {
    const mapsUrl = `https://www.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`;
    window.open(mapsUrl, '_blank');
  }
}
