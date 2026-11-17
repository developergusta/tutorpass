import { Injectable } from '@nestjs/common';
import {
  CONSENT_PURPOSE_META,
  ConsentService,
  type ConsentPurpose,
} from '../consent/consent.service';
import { RetentionService } from '../retention/retention.service';
import { SecurityIncidentService } from '../incidents/security-incident.service';

// Relatório de conformidade LGPD da escola (DPA-ready) — ver
// docs/product/IDEAS.md, frente e (ciclo 20):
// O art. 37 da LGPD exige o registro das operações de tratamento (RoPA):
// atividade, finalidade, categorias de titulares e de dados, base legal,
// sistemas/fornecedores, transferências, retenção e responsáveis. A ANPD
// pode pedir o RIPD (art. 5º, XVII) a qualquer momento — e o recomenda
// sempre que o tratamento puder gerar alto risco; dados de crianças em
// larga escala (o caso de toda escola) entram nesse critério (Res. CD/ANPD
// nº 2/2022, art. 4º). Este relatório é o inventário-base que a diretoria
// mostra a pais e à ANPD; a avaliação de risco do RIPD em si é da escola
// e do DPO, não do software.
// Regras de produto:
// - O relatório é GERADO a partir do estado real dos serviços (consentimentos,
//   expurgos, incidentes), nunca preenchido à mão: número inventado aqui é
//   pior que ausência — sem dado, a seção diz "sem registros".
// - O relatório NÃO contém dado pessoal: só contagens, categorias e
//   referências opacas (ids de incidente). Nenhum nome de aluno/tutor, nenhum
//   subjectId, nenhum conteúdo — o documento pode circular sem virar um
//   segundo vazamento (o DPO da escola e o contato dele são a exceção: são
//   os dados de contato do próprio relatório).
// - O checklist é o que a diretoria abre toda semana: cada item tem status
//   OK / ATENCAO / PENDENTE e um detalhe acionável; `gaps` resume o que
//   falta fazer. Nada aqui é "conformidade garantida" — é o retrato do que
//   o sistema sabe, com as pendências à mostra.
// - Escola = controladora; TutorPass = operadora (art. 5º, VI e VII).
//   O DPO é da escola: sem ele cadastrado, o relatório marca PENDENTE.
// Integração Step 2: persistir snapshots gerados (modelo ComplianceReport
// no schema, com hash do markdown) p/ provar o que o relatório dizia numa
// data; o controller REST /admin/compliance expõe generate + markdown.

/** Atividade de tratamento — uma linha do RoPA (art. 37). */
export interface TreatmentActivity {
  id: string;
  name: string;
  purpose: string;
  dataCategories: string[];
  /** Dado sensível (art. 11) — exige base reforçada. */
  sensitive: boolean;
  subjects: string[];
  /** Base legal (art. 7º / art. 11) + justificativa curta. */
  legalBasis: string;
  /** Prazo/critério de retenção e descarte. */
  retention: string;
  subProcessors: string[];
  /** Transferência internacional (art. 33) — exige hipótese própria. */
  internationalTransfer: boolean;
}

/**
 * Inventário de tratamentos do TutorPass — a fonte única de verdade do RoPA.
 * Cada linha espelha uma regra já implementada num serviço (o comentário
 * indica onde): mudar o produto sem atualizar aqui deixa o relatório mentindo.
 */
export const TREATMENT_ACTIVITIES: TreatmentActivity[] = [
  {
    id: 'ENROLLMENT',
    name: 'Cadastro de alunos, tutores e veículos (matrícula)',
    purpose: 'Formalizar o vínculo escolar e identificar quem pode retirar cada aluno.',
    dataCategories: ['nome', 'matrícula', 'turma', 'telefone do tutor', 'placa/marca/modelo do veículo'],
    sensitive: false,
    subjects: ['alunos', 'tutores'],
    legalBasis: 'Execução de contrato (art. 7º, V) — matrícula e prestação do serviço de saída.',
    retention: 'Enquanto durar a matrícula/vínculo; aluno nunca é apagado, só muda de status (RosterService).',
    subProcessors: [],
    internationalTransfer: false,
  },
  {
    id: 'PICKUP_LOG',
    name: 'Registro de retirada (PickupLog)',
    purpose: 'Provar quem retirou cada aluno, quando e por qual meio, com auditoria imutável.',
    dataCategories: ['nome do aluno', 'tutor/retirante', 'horário', 'modo de saída'],
    sensitive: false,
    subjects: ['alunos', 'tutores'],
    legalBasis: 'Execução de contrato (art. 7º, V) + guarda p/ exercício regular de direitos (art. 16, I).',
    retention: 'Sem expurgo — é a prova de conformidade (accountability, art. 37); não contém dado sensível.',
    subProcessors: [],
    internationalTransfer: false,
  },
  {
    id: 'QR_TOKEN',
    name: 'QR dinâmico de retirada (30 s, anti-replay)',
    purpose: 'Autenticar a retirada na portaria sem senha e sem documento físico.',
    dataCategories: ['identificador do tutor', 'nonce do token'],
    sensitive: false,
    subjects: ['tutores'],
    legalBasis: 'Execução de contrato (art. 7º, V) — autenticação da retirada.',
    retention: 'Nonce em Redis (SET NX, TTL 90 s) quando REDIS_URL configurado; senão só em memória, até a expiração do token (30 s) ou a validação (QrTokenService).',
    subProcessors: [],
    internationalTransfer: false,
  },
  {
    id: 'GUARDIAN_GEOLOCATION',
    name: 'Geolocalização do tutor (ETA e fila por proximidade)',
    purpose: 'Estimar a chegada do tutor e ordenar a fila por urgência, não por ordem de clique.',
    dataCategories: ['latitude/longitude (tempo real)'],
    sensitive: false,
    subjects: ['tutores'],
    legalBasis: 'Consentimento (art. 7º, I + art. 14) — finalidade GUARDIAN_GEOLOCATION, revogável a qualquer momento.',
    retention: '0 dias — a posição NUNCA é persistida; só o registro de consentimento fica no log (ConsentService).',
    subProcessors: [],
    internationalTransfer: false,
  },
  {
    id: 'DELEGATION_SELFIE',
    name: 'Selfie de delegação (quem retira no lugar do tutor)',
    purpose: 'Verificar na portaria quem está autorizado a retirar o aluno naquele dia.',
    dataCategories: ['imagem facial (biometria)'],
    sensitive: true,
    subjects: ['terceiros autorizados'],
    legalBasis: 'Consentimento explícito (art. 11, I + art. 14) — dado biométrico de menor; sem ele, a delegação não existe.',
    retention: '30 dias após a retirada; expurgo automático (RetentionService).',
    subProcessors: ['Armazenamento de objetos (S3) — referência opaca, nunca o conteúdo no log.'],
    internationalTransfer: false,
  },
  {
    id: 'STUDENT_PHOTO',
    name: 'Foto do aluno no painel da portaria/sala',
    purpose: 'Reconhecer o aluno pela foto em 1 segundo na hora da chamada.',
    dataCategories: ['foto do aluno'],
    sensitive: false,
    subjects: ['alunos'],
    legalBasis: 'Consentimento (art. 7º, I + art. 14) — finalidade STUDENT_PHOTO; imagem de menor.',
    retention: 'Enquanto durar a matrícula; expurgo automático ao fim dela (RetentionService).',
    subProcessors: [],
    internationalTransfer: false,
  },
  {
    id: 'PUSH_NOTIFICATIONS',
    name: 'Notificações push (chamada do aluno, decisão da saída antecipada)',
    purpose: 'Avisar o tutor na hora, com registro durável in-app quando o push falha (dual-path).',
    dataCategories: ['token do dispositivo', 'texto da notificação'],
    sensitive: false,
    subjects: ['tutores'],
    legalBasis: 'Consentimento (art. 7º, I) — finalidade PUSH_NOTIFICATIONS; o token some quando revogado.',
    retention: 'Token some com a revogação do consentimento; notificações lidas antigas são expurgadas (NotificationService).',
    subProcessors: ['Expo (push notifications)'],
    internationalTransfer: true,
  },
  {
    id: 'SECURITY_INCIDENT',
    name: 'Registro de incidentes de segurança',
    purpose: 'Registrar, conter e comunicar incidentes no prazo da ANPD (3 dias úteis).',
    dataCategories: ['categoria do incidente', 'categorias de dados envolvidos', 'contagem de titulares'],
    sensitive: false,
    subjects: ['alunos', 'tutores', 'staff'],
    legalBasis: 'Obrigação legal (art. 37, accountability; Res. CD/ANPD nº 15/2024).',
    retention: 'Enquanto necessário à apuração e à comunicação; o registro guarda SÓ categorias — nunca o conteúdo vazado.',
    subProcessors: [],
    internationalTransfer: false,
  },
];

export type CheckStatus = 'OK' | 'ATENCAO' | 'PENDENTE';

export interface ComplianceCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

export interface ConsentSummary {
  purpose: ConsentPurpose;
  label: string;
  /** Titulares com consentimento ativo (último evento = GRANT). */
  activeSubjects: number;
  /** Titulares que revogaram (último evento = REVOKE). */
  revokedSubjects: number;
  /** Versões do aviso de privacidade em uso nos consentimentos ativos. */
  noticeVersions: string[];
}

export interface ComplianceReport {
  reportVersion: string;
  schoolId: string;
  schoolName: string;
  generatedAt: Date;
  controller: string;
  operator: string;
  dpo: { name: string | null; contact: string | null };
  noticeVersion: string | null;
  treatments: TreatmentActivity[];
  consents: ConsentSummary[];
  retention: { pendingPurge: number; purgedTotal: number; chainsValid: boolean };
  incidents: { total: number; open: number; overdue: number; overdueIds: string[] };
  checks: ComplianceCheck[];
  gaps: string[];
  summary: { ok: number; atencao: number; pendente: number };
}

export interface GenerateComplianceReportInput {
  schoolId: string;
  schoolName: string;
  /** Encarregado de dados da escola (art. 41) — sem ele, o relatório marca PENDENTE. */
  dpoName?: string | null;
  dpoContact?: string | null;
  /** Versão do aviso de privacidade vigente na escola. */
  noticeVersion?: string | null;
}

@Injectable()
export class ComplianceReportService {
  constructor(
    private readonly consent: ConsentService,
    private readonly retention: RetentionService,
    private readonly incidents: SecurityIncidentService,
  ) {}

  generate(input: GenerateComplianceReportInput, now: Date = new Date()): ComplianceReport {
    const schoolId = input.schoolId;
    const dpoName = input.dpoName ?? null;
    const dpoContact = input.dpoContact ?? null;
    const noticeVersion = input.noticeVersion ?? null;

    const consents = this.consentSummary(schoolId);
    const retentionState = this.retentionSummary(schoolId, now);
    const incidentState = this.incidentSummary(schoolId, now);
    const chainsValid = this.chainsValid(schoolId);

    const checks: ComplianceCheck[] = [
      {
        id: 'dpo',
        label: 'Encarregado de dados (DPO) nomeado',
        status: dpoContact ? 'OK' : 'PENDENTE',
        detail: dpoContact
          ? `DPO: ${dpoName ?? 'sem nome cadastrado'} (${dpoContact}).`
          : 'Nenhum encarregado cadastrado — a LGPD (art. 41) exige um DPO como ponto de contato com titulares e ANPD.',
      },
      {
        id: 'aviso-privacidade',
        label: 'Aviso de privacidade com versão informada',
        status: noticeVersion ? 'OK' : 'PENDENTE',
        detail: noticeVersion
          ? `Versão vigente: ${noticeVersion}.`
          : 'Sem versão de aviso cadastrada — o consentimento informado (art. 14) exige registrar qual aviso foi exibido.',
      },
      {
        id: 'expurgo',
        label: 'Expurgo por retenção em dia',
        status: retentionState.pendingPurge === 0 ? 'OK' : 'ATENCAO',
        detail:
          retentionState.pendingPurge === 0
            ? 'Nenhum dado com retenção vencida aguardando expurgo.'
            : `${retentionState.pendingPurge} ${retentionState.pendingPurge === 1 ? 'item' : 'itens'} com retenção vencida aguardando expurgo — rode o ciclo de expurgo (RetentionService.purgeExpired).`,
      },
      {
        id: 'incidentes',
        label: 'Nenhum incidente com comunicação vencida',
        status: incidentState.overdue === 0 ? 'OK' : 'ATENCAO',
        detail:
          incidentState.overdue === 0
            ? 'Nenhum incidente com comunicação à ANPD vencida.'
            : `${incidentState.overdue} ${incidentState.overdue === 1 ? 'incidente' : 'incidentes'} com comunicação vencida (Res. CD/ANPD nº 15/2024 — 3 dias úteis): ${incidentState.overdueIds.join(', ')}.`,
      },
      {
        id: 'auditoria',
        label: 'Cadeias de auditoria íntegras',
        status: chainsValid ? 'OK' : 'ATENCAO',
        detail: chainsValid
          ? 'Consentimentos, expurgos e incidentes com hash encadeado verificado.'
          : 'Uma cadeia de auditoria falhou na verificação — investigar antes de apresentar este relatório.',
      },
      {
        id: 'transferencia-internacional',
        label: 'Transferência internacional mapeada',
        status: 'OK',
        detail:
          'Push via Expo (infra fora do BR) mapeado no RoPA; hipótese: consentimento específico (art. 33, I) — finalidade PUSH_NOTIFICATIONS. Sem ele, o push não é enviado.',
      },
      {
        id: 'ripd',
        label: 'RIPD elaborado (dados de crianças em larga escala)',
        status: 'PENDENTE',
        detail:
          'Recomendado pela ANPD p/ dados de crianças em larga escala (art. 5º, XVII; Res. CD/ANPD nº 2/2022, art. 4º). Este relatório é o inventário-base; a avaliação de risco é da escola e do DPO — o TutorPass não a escreve sozinho.',
      },
    ];

    const gaps = checks.filter((c) => c.status !== 'OK').map((c) => `${c.label}: ${c.detail}`);
    const summary = {
      ok: checks.filter((c) => c.status === 'OK').length,
      atencao: checks.filter((c) => c.status === 'ATENCAO').length,
      pendente: checks.filter((c) => c.status === 'PENDENTE').length,
    };

    return {
      reportVersion: '1',
      schoolId,
      schoolName: input.schoolName,
      generatedAt: now,
      controller: input.schoolName,
      operator: 'TutorPass (operadora — art. 5º, VII)',
      dpo: { name: dpoName, contact: dpoContact },
      noticeVersion,
      treatments: TREATMENT_ACTIVITIES,
      consents,
      retention: retentionState,
      incidents: incidentState,
      checks,
      gaps,
      summary,
    };
  }

  /** Renderiza o relatório como Markdown — o documento que a diretoria entrega a pais e à ANPD. */
  toMarkdown(report: ComplianceReport): string {
    const lines: string[] = [];
    lines.push(`# Relatório de conformidade LGPD — ${report.schoolName}`);
    lines.push('');
    lines.push(`Gerado em ${report.generatedAt.toISOString()} (versão ${report.reportVersion}).`);
    lines.push(`Controladora: ${report.controller}. Operadora: ${report.operator}.`);
    lines.push(
      `Encarregado de dados (DPO): ${report.dpo.name ?? 'não cadastrado'}${report.dpo.contact ? ` — ${report.dpo.contact}` : ''}.`,
    );
    lines.push(`Aviso de privacidade vigente: ${report.noticeVersion ?? 'não informado'}.`);
    lines.push('');
    lines.push('## Checklist de conformidade');
    lines.push('');
    for (const c of report.checks) {
      lines.push(`- [${c.status}] ${c.label} — ${c.detail}`);
    }
    lines.push('');
    lines.push(`Resumo: ${report.summary.ok} OK, ${report.summary.atencao} em atenção, ${report.summary.pendente} pendentes.`);
    lines.push('');
    if (report.gaps.length) {
      lines.push('## Pendências');
      lines.push('');
      for (const g of report.gaps) lines.push(`- ${g}`);
      lines.push('');
    }
    lines.push('## Registro das operações de tratamento (RoPA — art. 37)');
    lines.push('');
    lines.push('| Atividade | Finalidade | Dados | Base legal | Retenção | Suboperadores | Transf. internacional |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');
    for (const t of report.treatments) {
      lines.push(
        `| ${t.name} | ${t.purpose} | ${t.dataCategories.join(', ')}${t.sensitive ? ' (sensível)' : ''} | ${t.legalBasis} | ${t.retention} | ${t.subProcessors.join(', ') || '—'} | ${t.internationalTransfer ? 'Sim' : 'Não'} |`,
      );
    }
    lines.push('');
    lines.push('## Consentimentos por finalidade');
    lines.push('');
    for (const c of report.consents) {
      lines.push(
        `- ${c.label}: ${c.activeSubjects} ativo(s), ${c.revokedSubjects} revogado(s)${c.noticeVersions.length ? ` — aviso(s): ${c.noticeVersions.join(', ')}` : ''}.`,
      );
    }
    lines.push('');
    lines.push('## Retenção e expurgo');
    lines.push('');
    lines.push(
      `- ${report.retention.pendingPurge} ${report.retention.pendingPurge === 1 ? 'item' : 'itens'} com retenção vencida aguardando expurgo; ${report.retention.purgedTotal} expurgo(s) registrado(s); cadeias de auditoria ${report.retention.chainsValid ? 'íntegras' : 'COM FALHA'}.`,
    );
    lines.push('');
    lines.push('## Incidentes de segurança');
    lines.push('');
    lines.push(
      `- ${report.incidents.total} registrado(s), ${report.incidents.open} aberto(s), ${report.incidents.overdue} com comunicação vencida${report.incidents.overdueIds.length ? ` (${report.incidents.overdueIds.join(', ')})` : ''}.`,
    );
    lines.push('');
    lines.push('> Este relatório contém apenas contagens e categorias — nenhum dado pessoal de aluno, tutor ou staff. Os registros de auditoria (consentimentos, expurgos e incidentes) ficam no sistema, com hash encadeado, e não são expurgados.');
    return lines.join('\n');
  }

  private consentSummary(schoolId: string): ConsentSummary[] {
    const events = this.consent.listEvents(schoolId);
    return (Object.keys(CONSENT_PURPOSE_META) as ConsentPurpose[]).map((purpose) => {
      const latestBySubject = new Map<string, { type: 'GRANT' | 'REVOKE'; noticeVersion: string }>();
      for (const e of events) {
        if (e.purpose !== purpose) continue;
        latestBySubject.set(e.subjectId, { type: e.type, noticeVersion: e.noticeVersion });
      }
      const entries = [...latestBySubject.values()];
      return {
        purpose,
        label: CONSENT_PURPOSE_META[purpose].label,
        activeSubjects: entries.filter((e) => e.type === 'GRANT').length,
        revokedSubjects: entries.filter((e) => e.type === 'REVOKE').length,
        noticeVersions: [...new Set(entries.filter((e) => e.type === 'GRANT' && e.noticeVersion).map((e) => e.noticeVersion))].sort(),
      };
    });
  }

  private retentionSummary(schoolId: string, now: Date) {
    const pendingPurge = this.retention.dryRun(now).filter((d) => d.item.schoolId === schoolId).length;
    const purgedTotal = this.retention.purgeLog().filter((e) => e.schoolId === schoolId).length;
    return { pendingPurge, purgedTotal, chainsValid: this.chainsValid(schoolId) };
  }

  private incidentSummary(schoolId: string, now: Date) {
    const all = this.incidents.listForSchool(schoolId);
    const overdue = this.incidents.listOverdue(now).filter((i) => i.schoolId === schoolId);
    return {
      total: all.length,
      open: all.filter((i) => i.status !== 'CLOSED').length,
      overdue: overdue.length,
      overdueIds: overdue.map((i) => i.id),
    };
  }

  private chainsValid(schoolId: string): boolean {
    if (!this.consent.verifyChain()) return false;
    if (!this.retention.verifyChain()) return false;
    return this.incidents
      .listForSchool(schoolId)
      .every((i) => this.incidents.verifyChain(i.id));
  }
}
