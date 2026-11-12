export type UserRole = 'ALUMNO' | 'ADMIN';

export type MediaOrigen = 'PRE_EVENTO' | 'EN_VIVO' | 'FOTOGRAFO';
export type MediaEtapa = 'INICIO' | 'SUPERVIVENCIA' | 'RECTA_FINAL' | 'GALA';
export type MediaEstado =
  | 'PENDIENTE'
  | 'APROBADO_VIDEO'
  | 'APROBADO_GALERIA'
  | 'APROBADO_FOTOGRAFO'
  | 'RECHAZADO';
export type MediaTipo = 'FOTO' | 'VIDEO';
export type EventFase = 'PRE_EVENTO' | 'EN_VIVO' | 'MEMORIA';

export interface User {
  id: string;
  nombre_completo: string;
  distintivo_homonimo?: string | null;
  mesa?: string | null;
  rol: UserRole;
  tiene_pin: boolean;
  total_subidas?: number;
  updated_at?: string;
}

export interface MediaItem {
  id: string;
  usuario_id: string;
  origen: MediaOrigen;
  etapa: MediaEtapa;
  pie_de_foto: string;
  estado: MediaEstado;
  tipo_medio: MediaTipo;
  archivo_url: string;
  miniatura_url?: string | null;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
  duracion_seg?: number | null;
  solicitud_retiro: number | boolean;
  motivo_retiro?: string | null;
  moderado_por_id?: string | null;
  moderado_en?: string | null;
  created_at: string;
  autor_nombre?: string;
  autor_distintivo?: string | null;
  autor_mesa?: string | null;
  moderador_nombre?: string | null;
  storyboard_orden?: number | null;
  duracion_display_seg?: number;
  transicion?: string;
  reacciones_corazon?: number;
  reacciones_estrella?: number;
  reacciones_total?: number;
  mi_reaccion?: 'CORAZON' | 'ESTRELLA' | null;
}

export interface StoryboardItem extends MediaItem {
  sequence_id: string;
  orden: number;
  duracion_display_seg: number;
  transicion: string;
  notas_editor?: string | null;
}

export interface SystemConfig {
  id: number;
  nombre_generacion: string;
  titulo_evento: string;
  subtitulo_evento: string;
  fase_actual: EventFase;
  subidas_abiertas: boolean;
  moderacion_automatica_qr: boolean;
  duracion_foto_ensayo_seg: number;
  url_video_oficial?: string | null;
  codigo_acceso_salon: string;
  updated_at: string;
}

export interface AdminOverviewResponse {
  config: SystemConfig;
  stats: {
    pendientes: number;
    aprobados_video: number;
    aprobados_galeria: number;
    rechazados: number;
    solicitudes_retiro: number;
    pantallas_conectadas: number;
  };
  mediaItems: MediaItem[];
  storyboard: StoryboardItem[];
  users: User[];
}

