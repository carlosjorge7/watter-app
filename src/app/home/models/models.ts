export interface FountainData {
  ID: string;
  DESC_CLASIFICACION: string;
  COD_BARRIO: string;
  BARRIO: string;
  COD_DISTRITO: string;
  DISTRITO: string;
  ESTADO: string;
  COORD_GIS_X: string;
  COORD_GIS_Y: string;
  SISTEMA_COORD: string;
  LATITUD: number;
  LONGITUD: number;
  TIPO_VIA: string;
  NOM_VIA: string;
  NUM_VIA: string;
  COD_POSTAL: string;
  DIRECCION_AUX: string;
  NDP: string;
  FECHA_INSTALACION: string;
  CODIGO_INTERNO: string;
  CONTRATO_COD: string;
  UBICACION: string;
  USO: string;
  MODELO: string;
}

export interface Cordenadas {
  latitud: number;
  longitud: number;
}
