import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';
import { PlacesWatterService } from '../services/places-watter.service';
import { FuenteDTO } from '../models/models';
import { addIcons } from 'ionicons';
import { checkmarkCircle, warning, closeCircle, close } from 'ionicons/icons';

interface EstadisticaDistrito {
  distrito: string;
  numeroFuentes: number;
  fuentesMascotas: number;
  fuentesHumanos: number;
  fuentesMixtas: number;
  porcentajeMascotas: number;
  porcentajeHumanos: number;
  porcentajeMixtas: number;
  fuentesOperativas: number;
  fuentesNoOperativas: number;
  porcentajeOperativas: number;
}

@Component({
  selector: 'app-estadistics',
  templateUrl: './estadistics.component.html',
  styleUrls: ['./estadistics.component.css'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonGrid,
    IonRow,
    IonCol,
    IonChip,
    IonSpinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadisticsComponent implements OnInit {
  private placesService = inject(PlacesWatterService);
  private modalCtrl = inject(ModalController);

  estadisticas: EstadisticaDistrito[] = [];
  totalFuentes = 0;
  totalDistritos = 0;
  fuentesOperativasGlobal = 0;
  porcentajeOperativasGlobal = 0;
  fuentesSoloPersonasGlobal = 0;
  fuentesMixtasGlobal = 0;
  isLoading = true;

  constructor() {
    addIcons({
      'checkmark-circle': checkmarkCircle,
      warning,
      'close-circle': closeCircle,
      close,
    });
  }

  ngOnInit() {
    this.loadEstadisticas();
  }

  async closeModal() {
    await this.modalCtrl.dismiss();
  }

  private loadEstadisticas() {
    // Obtener fuentes desde la caché
    const fuentes = this.placesService.getCachedFountains();

    if (fuentes.length === 0) {
      // Si no hay fuentes en caché, cargar desde el servicio
      this.placesService.fountains$.subscribe((fountains) => {
        if (fountains.length > 0) {
          this.calculateEstadisticas(fountains);
          this.isLoading = false;
        }
      });
    } else {
      this.calculateEstadisticas(fuentes);
      this.isLoading = false;
    }
  }

  private calculateEstadisticas(fuentes: FuenteDTO[]) {
    // Agrupar por distrito
    const distritoMap = new Map<string, FuenteDTO[]>();

    fuentes.forEach((fuente) => {
      const distrito = fuente.DISTRITO || 'Sin especificar';
      if (!distritoMap.has(distrito)) {
        distritoMap.set(distrito, []);
      }
      distritoMap.get(distrito)!.push(fuente);
    });

    // Calcular estadísticas por distrito
    this.estadisticas = Array.from(distritoMap.entries())
      .map(([distrito, fuentesDistrito]) => {
        const total = fuentesDistrito.length;

        // Contar por tipo de uso
        let fuentesHumanos = 0;
        let fuentesMascotas = 0;
        let fuentesMixtas = 0;

        fuentesDistrito.forEach((fuente) => {
          const uso = fuente.USO?.trim() || '';

          if (uso === 'PERSONAS_Y_MASCOTAS') {
            fuentesMixtas++;
          } else if (uso === 'PERSONAS') {
            fuentesHumanos++;
          } else {
            // Si no está especificado o es otro valor, lo clasificamos como humanos por defecto
            fuentesHumanos++;
          }
        });

        // Contar fuentes operativas
        const fuentesOperativas = fuentesDistrito.filter((fuente) => {
          const estado = fuente.ESTADO?.toUpperCase().trim() || '';
          return (
            estado.includes('OPERATIVO') ||
            estado.includes('BUENO') ||
            estado.includes('FUNCIONANDO')
          );
        }).length;

        return {
          distrito,
          numeroFuentes: total,
          fuentesHumanos,
          fuentesMascotas,
          fuentesMixtas,
          porcentajeHumanos:
            total > 0 ? Math.round((fuentesHumanos / total) * 100) : 0,
          porcentajeMascotas:
            total > 0 ? Math.round((fuentesMascotas / total) * 100) : 0,
          porcentajeMixtas:
            total > 0 ? Math.round((fuentesMixtas / total) * 100) : 0,
          fuentesOperativas,
          fuentesNoOperativas: total - fuentesOperativas,
          porcentajeOperativas:
            total > 0 ? Math.round((fuentesOperativas / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.numeroFuentes - a.numeroFuentes); // Ordenar por número de fuentes descendente

    // Calcular estadísticas globales
    this.totalFuentes = fuentes.length;
    this.totalDistritos = distritoMap.size;
    this.fuentesOperativasGlobal = this.estadisticas.reduce(
      (sum, est) => sum + est.fuentesOperativas,
      0
    );
    this.fuentesSoloPersonasGlobal = this.estadisticas.reduce(
      (sum, est) => sum + est.fuentesHumanos,
      0
    );
    this.fuentesMixtasGlobal = this.estadisticas.reduce(
      (sum, est) => sum + est.fuentesMixtas,
      0
    );
    this.porcentajeOperativasGlobal =
      this.totalFuentes > 0
        ? Math.round((this.fuentesOperativasGlobal / this.totalFuentes) * 100)
        : 0;
  }

  getOperativeColor(percentage: number): string {
    if (percentage >= 80) return 'success';
    if (percentage >= 60) return 'warning';
    return 'danger';
  }

  getStatusIcon(percentage: number): string {
    if (percentage >= 80) return 'checkmark-circle';
    if (percentage >= 60) return 'warning';
    return 'close-circle';
  }
}
