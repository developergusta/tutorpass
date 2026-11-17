import { Inject, Injectable, Optional } from '@nestjs/common';

// Alerta da portaria via ntfy (self-hosted, serviço do kit essencial) — o
// celular de quem fica na portaria apita quando um tutor entra na fila,
// mesmo com a tela bloqueada e sem depender da tela da portaria/telão.
// Desenho:
// - Um tópico por escola: `tutorpass-<schoolId>-portaria`. O schoolId é
//   UUID (imprevisível) e o servidor ntfy roda com deny-all: só o usuário
//   publicador da API posta (token) e só os celulares autorizados assinam.
// - Mensagem ENXUTA por LGPD: nada de nome de aluno/tutor no corpo — a
//   notificação é o "sinal de atenção"; o detalhe (quem, qual sala) fica
//   nas telas internas (portaria/telão), onde já existe controle de acesso.
// - Best-effort de verdade: publicar nunca lança e nunca atrasa a fila —
//   falha de rede/ntfy fora do ar é logada e engolida (a fila e o realtime
//   seguem sendo a fonte primária). Sem NTFY_BASE_URL, o serviço fica
//   desligado (dev/testes) e `enabled` é false.

export interface NtfyConfig {
  baseUrl?: string;
  token?: string;
  topicPrefix?: string;
}

type FetchFn = typeof fetch;

@Injectable()
export class GateAlertService {
  private readonly baseUrl?: string;
  private readonly token?: string;
  private readonly topicPrefix: string;
  private readonly fetchFn: FetchFn;

  constructor(
    @Optional() @Inject('NTFY_CONFIG') config?: NtfyConfig,
    @Optional() @Inject('NTFY_FETCH') fetchFn?: FetchFn,
  ) {
    this.baseUrl = (config?.baseUrl ?? process.env.NTFY_BASE_URL ?? '').replace(/\/+$/, '') || undefined;
    this.token = config?.token ?? process.env.NTFY_TOKEN;
    this.topicPrefix = config?.topicPrefix ?? process.env.NTFY_TOPIC_PREFIX ?? 'tutorpass';
    this.fetchFn = fetchFn ?? ((...args: Parameters<FetchFn>) => fetch(...args));
  }

  get enabled(): boolean {
    return Boolean(this.baseUrl);
  }

  /** Tópico da portaria de uma escola — é este nome que o celular assina. */
  topicFor(schoolId: string): string {
    return `${this.topicPrefix}-${schoolId}-portaria`;
  }

  /** Tutor entrou na fila de retirada (join manual, geofence ou QR do portão). */
  async tutorJoinedQueue(schoolId: string, gate: string | null): Promise<boolean> {
    const body = gate
      ? `Tutor entrou na fila de retirada · ${gate}. Veja a tela da portaria.`
      : 'Tutor entrou na fila de retirada. Veja a tela da portaria.';
    return this.publish(schoolId, 'Portaria — tutor chegou', body);
  }

  private async publish(schoolId: string, title: string, body: string): Promise<boolean> {
    if (!this.baseUrl) return false;
    try {
      const res = await this.fetchFn(`${this.baseUrl}/${this.topicFor(schoolId)}`, {
        method: 'POST',
        headers: {
          Title: title,
          Tags: 'bell',
          Priority: 'high',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body,
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error(`[GateAlertService] ntfy respondeu HTTP ${res.status} p/ a escola ${schoolId}`);
        return false;
      }
      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GateAlertService] falha ao publicar no ntfy:', err);
      return false;
    }
  }
}
