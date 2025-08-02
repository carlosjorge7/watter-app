import { Component, Input, inject } from '@angular/core';
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
  IonCardHeader,
  IonCardTitle,
  IonChip,
  IonLabel,
  ModalController,
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';
import { CommonModule, DecimalPipe } from '@angular/common';
import { addIcons } from 'ionicons';
import {
  water,
  close,
  checkmarkCircle,
  closeCircle,
  construct,
  helpCircle,
  location,
  business,
  home,
  navigate,
  arrowUp,
  arrowForward,
  map,
  share,
  bulb,
} from 'ionicons/icons';

@Component({
  selector: 'app-info-location',
  templateUrl: './info-location.component.html',
  styleUrls: ['./info-location.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonIcon,
    IonContent,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonLabel,
  ],
})
export class InfoLocationComponent {
  @Input() marker!: any;

  private modalCtrl = inject(ModalController);

  constructor() {
    addIcons({
      water,
      close,
      'checkmark-circle': checkmarkCircle,
      'close-circle': closeCircle,
      construct,
      'help-circle': helpCircle,
      location,
      business,
      home,
      navigate,
      'arrow-up': arrowUp,
      'arrow-forward': arrowForward,
      map,
      share,
      bulb,
    });
  }

  public async goGoogleMaps(): Promise<void> {
    const mapsUrl = `https://maps.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`;
    await Browser.open({ url: mapsUrl });
  }

  public async closeModal(): Promise<void> {
    await this.modalCtrl.dismiss();
  }

  public async shareLocation(): Promise<void> {
    try {
      // Usar Web Share API si está disponible
      if (navigator.share) {
        await navigator.share({
          title: 'Fuente de agua encontrada',
          text: `He encontrado una fuente de agua en ${this.getDistrict()}, ${this.getNeighborhood()}`,
          url: `https://maps.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`,
        });
      } else {
        // Fallback: copiar al portapapeles
        const text = `Fuente de agua en ${this.getDistrict()}, ${this.getNeighborhood()}: https://maps.google.com/maps?q=${
          this.marker.latitude
        },${this.marker.longitude}`;
        await navigator.clipboard.writeText(text);
        console.log('Ubicación copiada al portapapeles');
      }
    } catch (error) {
      console.log('Error sharing:', error);
    }
  }

  public getStatusText(): string {
    // Primero intentar obtener el estado desde markerData
    if (this.marker.markerData && this.marker.markerData.estado) {
      const estado = this.marker.markerData.estado.toString().toUpperCase();
      console.log('🔍 Estado encontrado:', estado);
      return this.normalizeStatus(estado);
    }

    // Fallback: buscar en el título
    const title = this.marker.title || '';
    console.log('🔍 Título del marcador:', title);

    if (title.includes('Estado:')) {
      const estatePart = title.split('Estado:')[1]?.split(',')[0]?.trim();
      if (estatePart) {
        return this.normalizeStatus(estatePart.toUpperCase());
      }
    }

    return 'Estado desconocido';
  }

  private normalizeStatus(status: string): string {
    status = status.toUpperCase().trim();

    if (
      status.includes('FUNCIONANDO') ||
      status.includes('OPERATIVO') ||
      status.includes('EN SERVICIO')
    ) {
      return 'Funcionando';
    } else if (
      status.includes('FUERA') ||
      status.includes('NO OPERATIVO') ||
      status.includes('AVERIADO')
    ) {
      return 'Fuera de servicio';
    } else if (
      status.includes('MANTENIMIENTO') ||
      status.includes('REPARACION')
    ) {
      return 'En mantenimiento';
    }

    console.log('⚠️ Estado no reconocido:', status);
    return status || 'Estado desconocido';
  }

  public getStatusClass(): string {
    const status = this.getStatusText();
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

  public getStatusIcon(): string {
    const status = this.getStatusText();
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

  public getDistrict(): string {
    // Primero intentar obtener desde markerData
    if (this.marker.markerData && this.marker.markerData.distrito) {
      return this.marker.markerData.distrito;
    }

    // Fallback: buscar en el título
    const title = this.marker.title || '';
    const parts = title.split(',');
    if (parts.length > 1) {
      return parts[1].trim().replace('Zona: ', '');
    }
    return 'Distrito no disponible';
  }

  public getNeighborhood(): string {
    // Primero intentar obtener desde markerData
    if (this.marker.markerData && this.marker.markerData.barrio) {
      return this.marker.markerData.barrio;
    }

    // Fallback: buscar en el título
    const title = this.marker.title || '';
    const parts = title.split(',');
    if (parts.length > 2) {
      return parts[2].trim().replace('Barrio: ', '');
    }
    return 'Barrio no disponible';
  }

  public getTips(): string[] {
    return [
      'Lleva tu propia botella reutilizable',
      'Verifica que el agua fluya correctamente',
      'Reporta cualquier problema encontrado',
    ];
  }
}
