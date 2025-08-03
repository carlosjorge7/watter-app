import { Component, Input, inject, OnInit, OnDestroy } from '@angular/core';
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
import { CommonModule, DecimalPipe, AsyncPipe } from '@angular/common';
import { FavoritesService, Fountain } from '../services/favorites.service';
import { Observable, Subject, takeUntil } from 'rxjs';
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
  heart,
  heartOutline,
  people,
  paw,
} from 'ionicons/icons';

// Interfaces
interface MarkerData {
  distrito?: string;
  barrio?: string;
  estado?: string | number;
  uso?: string;
}

interface FountainMarker {
  latitude: number;
  longitude: number;
  title?: string;
  markerData?: MarkerData;
}

@Component({
  selector: 'app-info-location',
  templateUrl: './info-location.component.html',
  styleUrls: ['./info-location.component.scss'],
  imports: [
    CommonModule,
    DecimalPipe,
    AsyncPipe,
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
export class InfoLocationComponent implements OnInit, OnDestroy {
  @Input() marker!: FountainMarker;

  public isFavorite$!: Observable<boolean>;
  private destroy$ = new Subject<void>();

  private modalCtrl = inject(ModalController);
  private favoritesService = inject(FavoritesService);

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
      heart,
      'heart-outline': heartOutline,
      people,
      paw,
    });
  }

  ngOnInit(): void {
    // Crear un objeto Fountain a partir del marker
    const fountain: Fountain = {
      LATITUD: this.marker.latitude,
      LONGITUD: this.marker.longitude,
      DISTRITO: this.marker.markerData?.distrito,
      BARRIO: this.marker.markerData?.barrio,
      ESTADO: this.marker.markerData?.estado?.toString(),
    };

    this.isFavorite$ = this.favoritesService.isFavorite(fountain);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
      if (navigator.share) {
        await navigator.share({
          title: 'Fuente de agua encontrada',
          text: `He encontrado una fuente de agua en ${this.getDistrict()}, ${this.getNeighborhood()}`,
          url: `https://maps.google.com/maps?q=${this.marker.latitude},${this.marker.longitude}`,
        });
      } else {
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

  public getUsage(): string {
    // Primero intentar obtener desde markerData
    if (this.marker.markerData && this.marker.markerData.uso) {
      return this.normalizeUsage(this.marker.markerData.uso);
    }

    // Fallback: buscar en el título
    const title = this.marker.title || '';
    if (title.includes('Uso:')) {
      const usagePart = title.split('Uso:')[1]?.split(',')[0]?.trim();
      if (usagePart) {
        return this.normalizeUsage(usagePart);
      }
    }

    return 'Uso no especificado';
  }

  private normalizeUsage(usage: string): string {
    const normalizedUsage = usage.toUpperCase().trim();

    if (
      normalizedUsage.includes('PERSONAS_Y_MASCOTAS') ||
      normalizedUsage.includes('PERSONAS Y MASCOTAS')
    ) {
      return 'Personas y mascotas';
    } else if (normalizedUsage.includes('PERSONAS')) {
      return 'Solo personas';
    }

    return usage || 'Uso no especificado';
  }

  public getUsageIcon(): string {
    const usage = this.getUsage();
    if (usage === 'Personas y mascotas') {
      return 'paw';
    } else if (usage === 'Solo personas') {
      return 'people';
    }
    return 'help-circle';
  }

  public getTips(): string[] {
    return [
      'Lleva tu propia botella reutilizable',
      'Verifica que el agua fluya correctamente',
      'Reporta cualquier problema encontrado',
    ];
  }

  /**
   * Alterna el estado de favorito de la fuente
   */
  public toggleFavorite(): void {
    const fountain: Fountain = {
      LATITUD: this.marker.latitude,
      LONGITUD: this.marker.longitude,
      DISTRITO: this.marker.markerData?.distrito,
      BARRIO: this.marker.markerData?.barrio,
      ESTADO: this.marker.markerData?.estado?.toString(),
    };

    this.favoritesService.toggleFavorite(fountain);
  }
}
