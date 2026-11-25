'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import RequireAuth from '../../../../components/RequireAuth';
import {
  addPetVaccination,
  getPetProfileBundle,
  loadSession,
  removePetVaccination,
  upsertPetProfile,
  type PetProfileBundle,
  type PetSize,
  type PetVaccination,
} from '../../../../lib/api';

type VaccineVisualStatus = {
  tone: 'danger' | 'warn' | 'ok';
  label: string;
};

function evaluateVaccineStatus(expiresAt?: string): VaccineVisualStatus {
  if (!expiresAt) {
    return { tone: 'ok', label: 'Registrada (sem validade)' };
  }
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const in30DaysIso = new Date(now.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  if (expiresAt < todayIso) {
    return { tone: 'danger', label: 'Vencida' };
  }
  if (expiresAt <= in30DaysIso) {
    return { tone: 'warn', label: 'Vence em até 30 dias' };
  }
  return { tone: 'ok', label: 'Em dia' };
}

function formatDateBr(iso?: string): string {
  if (!iso) return '—';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function FichaDoPetView() {
  const params = useParams<{ studentId: string }>();
  const studentId = params?.studentId ?? '';

  const [bundle, setBundle] = useState<PetProfileBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado do formulário de edição da ficha
  const [breed, setBreed] = useState('');
  const [size, setSize] = useState<PetSize | ''>('');
  const [sex, setSex] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [isNeutered, setIsNeutered] = useState<'yes' | 'no' | ''>('');
  const [behaviorNotes, setBehaviorNotes] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [feedingFood, setFeedingFood] = useState('');
  const [feedingPortionGrams, setFeedingPortionGrams] = useState('');
  const [feedingTimesText, setFeedingTimesText] = useState('');
  const [dewormingUpToDate, setDewormingUpToDate] = useState(true);
  const [dewormingLastDate, setDewormingLastDate] = useState('');
  const [fleaControlUpToDate, setFleaControlUpToDate] = useState(true);
  const [fleaControlLastDate, setFleaControlLastDate] = useState('');
  const [allergies, setAllergies] = useState('');
  const [medicationName, setMedicationName] = useState('');
  const [medicationDosage, setMedicationDosage] = useState('');
  const [medicationSchedule, setMedicationSchedule] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetClinic, setVetClinic] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');

  // Formulário de nova vacina
  const [vaccineName, setVaccineName] = useState('');
  const [appliedAt, setAppliedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [vaccineNotes, setVaccineNotes] = useState('');
  const [addingVaccine, setAddingVaccine] = useState(false);

  const session = loadSession();
  const canEdit = Boolean(
    session?.roles.some((r) => r === 'ADMIN' || r === 'COORDINATOR'),
  );

  const populateForm = useCallback((b: PetProfileBundle) => {
    const p = b.profile;
    setBreed(p?.breed ?? '');
    setSize(p?.size ?? '');
    setSex(p?.sex ?? '');
    setWeightKg(p?.weightKg != null ? String(p.weightKg) : '');
    setIsNeutered(p?.isNeutered === true ? 'yes' : p?.isNeutered === false ? 'no' : '');
    setBehaviorNotes(p?.behaviorNotes ?? '');
    setRestrictions(p?.restrictions ?? '');
    setFeedingFood(p?.feedingFood ?? '');
    setFeedingPortionGrams(
      p?.feedingPortionGrams != null ? String(p.feedingPortionGrams) : '',
    );
    setFeedingTimesText((p?.feedingTimes ?? []).join(', '));
    setDewormingUpToDate(p?.dewormingUpToDate ?? true);
    setDewormingLastDate(p?.dewormingLastDate ?? '');
    setFleaControlUpToDate(p?.fleaControlUpToDate ?? true);
    setFleaControlLastDate(p?.fleaControlLastDate ?? '');
    setAllergies(p?.allergies ?? '');
    setMedicationName(p?.medicationName ?? '');
    setMedicationDosage(p?.medicationDosage ?? '');
    setMedicationSchedule(p?.medicationSchedule ?? '');
    setVetName(p?.vetName ?? '');
    setVetClinic(p?.vetClinic ?? '');
    setEmergencyContactName(p?.emergencyContactName ?? '');
    setEmergencyContactPhone(p?.emergencyContactPhone ?? '');
  }, []);

  const reload = useCallback(async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getPetProfileBundle(studentId);
      setBundle(data);
      populateForm(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar a ficha do pet.',
      );
    } finally {
      setLoading(false);
    }
  }, [studentId, populateForm]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const times = feedingTimesText
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      await upsertPetProfile(studentId, {
        breed: breed.trim() || undefined,
        size: size || undefined,
        sex: sex.trim() || undefined,
        weightKg: weightKg.trim() ? Number(weightKg) : undefined,
        isNeutered: isNeutered === 'yes' ? true : isNeutered === 'no' ? false : undefined,
        behaviorNotes: behaviorNotes.trim() || undefined,
        restrictions: restrictions.trim() || undefined,
        feedingFood: feedingFood.trim() || undefined,
        feedingPortionGrams: feedingPortionGrams.trim()
          ? Number(feedingPortionGrams)
          : undefined,
        feedingTimes: times,
        dewormingUpToDate,
        dewormingLastDate: dewormingLastDate || undefined,
        fleaControlUpToDate,
        fleaControlLastDate: fleaControlLastDate || undefined,
        allergies: allergies.trim() || undefined,
        medicationName: medicationName.trim() || undefined,
        medicationDosage: medicationDosage.trim() || undefined,
        medicationSchedule: medicationSchedule.trim() || undefined,
        vetName: vetName.trim() || undefined,
        vetClinic: vetClinic.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
      });
      await reload();
      setEditing(false);
      setNotice('Ficha do pet atualizada com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar a ficha.');
    } finally {
      setSaving(false);
    }
  }

  async function onAddVaccine(e: FormEvent) {
    e.preventDefault();
    if (!vaccineName.trim()) return;
    setAddingVaccine(true);
    setError(null);
    setNotice(null);
    try {
      await addPetVaccination(studentId, {
        vaccineName: vaccineName.trim(),
        appliedAt: appliedAt || undefined,
        expiresAt: expiresAt || undefined,
        notes: vaccineNotes.trim() || undefined,
      });
      setVaccineName('');
      setAppliedAt('');
      setExpiresAt('');
      setVaccineNotes('');
      await reload();
      setNotice('Vacina registrada no cartão do pet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar vacina.');
    } finally {
      setAddingVaccine(false);
    }
  }

  async function onDeleteVaccine(v: PetVaccination) {
    setError(null);
    setNotice(null);
    try {
      await removePetVaccination(studentId, v.id);
      await reload();
      setNotice(`Vacina "${v.vaccineName}" removida.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover a vacina.');
    }
  }

  const p = bundle?.profile;
  const alerts = bundle?.clinicalAlerts;

  return (
    <main id="conteudo" tabIndex={-1} className="container container-wide section pandhowan-dashboard">
      <header className="pandhowan-header">
        <div>
          <span className="eyebrow-mono">FICHA DO PET · PRONTUÁRIO DE CRECHE &amp; HOTEL</span>
          <h1 className="section-title">
            {bundle ? bundle.student.name : 'Carregando ficha…'}
            {bundle?.student.enrollmentCode ? (
              <span className="badge off wb-mono">{bundle.student.enrollmentCode}</span>
            ) : null}
          </h1>
          <p className="muted">
            Carteira de vacinação com alerta de validade, alimentação (&ldquo;almocinho&rdquo;),
            medicação em horário de creche (07:00–18:00), comportamento e emergência veterinária.
          </p>
        </div>
        <div className="pandhowan-header-actions">
          <Link className="btn secondary small" href="/escola">
            Voltar ao cadastro
          </Link>
          <Link className="btn secondary small" href="/portaria">
            Ir para recepção / portaria
          </Link>
          {canEdit && bundle ? (
            <button
              type="button"
              className="btn small"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Fechar edição' : 'Editar ficha'}
            </button>
          ) : null}
        </div>
      </header>

      {error ? (
        <p className="alert error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? <p className="alert ok">{notice}</p> : null}

      {/* Faixa de alertas clínicos ativos (vacina vencida ou medicação em horário de creche) */}
      {alerts?.hasExpiredVaccination ? (
        <div className="alert error" role="alert">
          <strong>Atenção — Vacinação vencida:</strong>{' '}
          {alerts.expiredVaccines.join(', ')}. Exibido como alerta vermelho na fila da recepção.
        </div>
      ) : alerts?.hasExpiringVaccination ? (
        <div className="alert warn" role="status">
          <strong>Vacinação próxima do vencimento (30 dias):</strong>{' '}
          {alerts.expiringVaccines.join(', ')}.
        </div>
      ) : null}

      {alerts?.hasDaycareMedication ? (
        <div className="alert warn" role="status">
          <strong>Medicação programada durante a creche (07:00–18:00):</strong>{' '}
          {alerts.medicationSummary}. Exibido com alerta na fila da recepção.
        </div>
      ) : null}

      {loading ? (
        <section className="card">
          <p className="muted">Carregando dados da ficha…</p>
        </section>
      ) : !bundle ? null : (
        <>
          {/* Resumo rápido de 4 indicadores no padrão Pandhowan */}
          <section className="pandhowan-metrics" aria-label="Resumo físico e preventivo">
            <div className="pandhowan-metric-card">
              <span className="pm-label">RAÇA &amp; PORTE</span>
              <strong className="pm-value" style={{ fontSize: '1.25rem' }}>
                {p?.breed ?? 'Não informada'}
              </strong>
              <span className="pm-meta">
                Porte: {p?.size ?? '—'} · Sexo: {p?.sex ?? '—'}
              </span>
            </div>
            <div className="pandhowan-metric-card">
              <span className="pm-label">PESO &amp; CASTRAÇÃO</span>
              <strong className="pm-value" style={{ fontSize: '1.25rem' }}>
                {p?.weightKg != null ? `${p.weightKg} kg` : '—'}
              </strong>
              <span className="pm-meta">
                Castrado(a):{' '}
                {p?.isNeutered === true ? 'Sim' : p?.isNeutered === false ? 'Não' : '—'}
              </span>
            </div>
            <div className="pandhowan-metric-card">
              <span className="pm-label">VERMÍFUGO &amp; ANTIPULGAS</span>
              <strong className="pm-value" style={{ fontSize: '1.25rem' }}>
                {p?.dewormingUpToDate && p?.fleaControlUpToDate ? 'Em dia' : 'Conferir'}
              </strong>
              <span className="pm-meta">
                Verm.: {formatDateBr(p?.dewormingLastDate)} · Pulgas:{' '}
                {formatDateBr(p?.fleaControlLastDate)}
              </span>
            </div>
            <div className="pandhowan-metric-card">
              <span className="pm-label">ALMOCINHO / RAÇÃO</span>
              <strong className="pm-value" style={{ fontSize: '1.25rem' }}>
                {p?.feedingPortionGrams != null ? `${p.feedingPortionGrams} g` : '—'}
              </strong>
              <span className="pm-meta">
                Horários:{' '}
                {p?.feedingTimes && p.feedingTimes.length > 0
                  ? p.feedingTimes.join(' · ')
                  : 'Não programado'}
              </span>
            </div>
          </section>

          {/* Formulário de edição (ADMIN / COORDINATOR) */}
          {editing && canEdit ? (
            <form className="card roster-form" onSubmit={onSaveProfile}>
              <h2>Editar Ficha do Pet</h2>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="fp-breed">Raça</label>
                  <input
                    id="fp-breed"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder="Ex.: Spitz Alemão"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-size">Porte</label>
                  <select
                    id="fp-size"
                    value={size}
                    onChange={(e) => setSize(e.target.value as PetSize | '')}
                  >
                    <option value="">Selecione…</option>
                    <option value="PEQUENO">PEQUENO</option>
                    <option value="MEDIO">MEDIO</option>
                    <option value="GRANDE">GRANDE</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fp-sex">Sexo</label>
                  <input
                    id="fp-sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    placeholder="Macho / Fêmea"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-weight">Peso (kg)</label>
                  <input
                    id="fp-weight"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="3.8"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-neutered">Castrado(a)</label>
                  <select
                    id="fp-neutered"
                    value={isNeutered}
                    onChange={(e) => setIsNeutered(e.target.value as 'yes' | 'no' | '')}
                  >
                    <option value="">Não informado</option>
                    <option value="yes">Sim</option>
                    <option value="no">Não</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="fp-food">Ração / Alimentação</label>
                  <input
                    id="fp-food"
                    value={feedingFood}
                    onChange={(e) => setFeedingFood(e.target.value)}
                    placeholder="Ex.: Premier Ambientes Internos Mini"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-grams">Porção por refeição (gramas)</label>
                  <input
                    id="fp-grams"
                    type="number"
                    min="1"
                    value={feedingPortionGrams}
                    onChange={(e) => setFeedingPortionGrams(e.target.value)}
                    placeholder="60"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-times">Horários de alimentação (separados por vírgula)</label>
                  <input
                    id="fp-times"
                    value={feedingTimesText}
                    onChange={(e) => setFeedingTimesText(e.target.value)}
                    placeholder="12:00, 16:00"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-deworm-date">Último vermífugo</label>
                  <input
                    id="fp-deworm-date"
                    type="date"
                    value={dewormingLastDate}
                    onChange={(e) => setDewormingLastDate(e.target.value)}
                  />
                  <label className="security-check" style={{ marginTop: 6, minHeight: 32 }}>
                    <input
                      type="checkbox"
                      checked={dewormingUpToDate}
                      onChange={(e) => setDewormingUpToDate(e.target.checked)}
                    />
                    Vermífugo em dia
                  </label>
                </div>
                <div className="field">
                  <label htmlFor="fp-flea-date">Último antipulgas/carrapatos</label>
                  <input
                    id="fp-flea-date"
                    type="date"
                    value={fleaControlLastDate}
                    onChange={(e) => setFleaControlLastDate(e.target.value)}
                  />
                  <label className="security-check" style={{ marginTop: 6, minHeight: 32 }}>
                    <input
                      type="checkbox"
                      checked={fleaControlUpToDate}
                      onChange={(e) => setFleaControlUpToDate(e.target.checked)}
                    />
                    Antipulgas em dia
                  </label>
                </div>
                <div className="field">
                  <label htmlFor="fp-med-name">Medicação em uso (nome)</label>
                  <input
                    id="fp-med-name"
                    value={medicationName}
                    onChange={(e) => setMedicationName(e.target.value)}
                    placeholder="Deixe em branco se não usa"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-med-dose">Dosagem da medicação</label>
                  <input
                    id="fp-med-dose"
                    value={medicationDosage}
                    onChange={(e) => setMedicationDosage(e.target.value)}
                    placeholder="Ex.: 1 comprimido / 5 gotas"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-med-sched">Horário da medicação</label>
                  <input
                    id="fp-med-sched"
                    value={medicationSchedule}
                    onChange={(e) => setMedicationSchedule(e.target.value)}
                    placeholder="Ex.: 12:30 (junto ao almocinho na creche)"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-allergies">Alergias</label>
                  <input
                    id="fp-allergies"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Ex.: Alergia a frango / shampoo perfumado"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-behavior">Avaliação comportamental (Dócil &amp; Sociável)</label>
                  <input
                    id="fp-behavior"
                    value={behaviorNotes}
                    onChange={(e) => setBehaviorNotes(e.target.value)}
                    placeholder="Observações de socialização e enriquecimento"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-restr">Restrições de convivência / manejo</label>
                  <input
                    id="fp-restr"
                    value={restrictions}
                    onChange={(e) => setRestrictions(e.target.value)}
                    placeholder="Ex.: Sensível a trovões; usar peitoral no portão"
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-vet">Veterinário(a) responsável</label>
                  <input
                    id="fp-vet"
                    value={vetName}
                    onChange={(e) => setVetName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-clinic">Clínica veterinária</label>
                  <input
                    id="fp-clinic"
                    value={vetClinic}
                    onChange={(e) => setVetClinic(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-em-name">Contato de emergência (nome)</label>
                  <input
                    id="fp-em-name"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fp-em-phone">Contato de emergência (telefone)</label>
                  <input
                    id="fp-em-phone"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                  />
                </div>
              </div>
              <p style={{ marginTop: 16 }}>
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar ficha'}
                </button>
              </p>
            </form>
          ) : null}

          {/* 1. CARTEIRA DE VACINAÇÃO COM STATUS VISUAL (VERMELHO / AMARELO / VERDE) */}
          <section className="card">
            <h2>Carteira de Vacinação</h2>
            <p className="muted">
              Status visual de validade: <span className="badge">Em dia</span>{' '}
              <span className="badge warn">Vence em até 30 dias</span>{' '}
              <span className="badge danger">Vencida</span>
            </p>
            <div className="pandhowan-table-shell" style={{ marginTop: 12 }}>
              <div className="pandhowan-table-head" aria-hidden="true">
                <span>VACINA / APLICAÇÃO / VALIDADE / OBSERVAÇÕES</span>
                <span>STATUS</span>
              </div>
              <ul className="roster-list">
                {bundle.vaccinations.length === 0 ? (
                  <li className="roster-empty muted">
                    Nenhuma vacina cadastrada para este pet.
                  </li>
                ) : (
                  bundle.vaccinations.map((v) => {
                    const st = evaluateVaccineStatus(v.expiresAt);
                    return (
                      <li key={v.id} className="roster-row">
                        <span>
                          <strong>{v.vaccineName}</strong>
                          <span className="muted">
                            {' '}
                            · Aplicada em {formatDateBr(v.appliedAt)} · Validade:{' '}
                            <strong className="wb-mono">{formatDateBr(v.expiresAt)}</strong>
                          </span>
                          {v.notes ? <span className="muted"> · {v.notes}</span> : null}
                        </span>
                        <span className="row-actions">
                          <span
                            className={`badge${
                              st.tone === 'danger'
                                ? ' danger'
                                : st.tone === 'warn'
                                  ? ' warn'
                                  : ''
                            }`}
                          >
                            {st.label}
                          </span>
                          {canEdit ? (
                            <button
                              type="button"
                              className="btn secondary small"
                              onClick={() => void onDeleteVaccine(v)}
                            >
                              Remover
                            </button>
                          ) : null}
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            {canEdit ? (
              <form onSubmit={onAddVaccine} style={{ marginTop: 16 }}>
                <h3>Registrar nova dose de vacina</h3>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="vac-name">Vacina (ex.: Antirrábica, V10, Giardíase)</label>
                    <input
                      id="vac-name"
                      required
                      value={vaccineName}
                      onChange={(e) => setVaccineName(e.target.value)}
                      placeholder="Antirrábica"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="vac-app">Data de aplicação</label>
                    <input
                      id="vac-app"
                      type="date"
                      value={appliedAt}
                      onChange={(e) => setAppliedAt(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="vac-exp">Data de vencimento</label>
                    <input
                      id="vac-exp"
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="vac-notes">Lote / Observação</label>
                    <input
                      id="vac-notes"
                      value={vaccineNotes}
                      onChange={(e) => setVaccineNotes(e.target.value)}
                      placeholder="Reforço anual"
                    />
                  </div>
                </div>
                <p style={{ marginTop: 12 }}>
                  <button className="btn secondary small" type="submit" disabled={addingVaccine}>
                    {addingVaccine ? 'Adicionando…' : 'Adicionar vacina'}
                  </button>
                </p>
              </form>
            ) : null}
          </section>

          {/* 2. BLOCOS DE ALIMENTAÇÃO ("ALMOCINHO") E MEDICAÇÃO / ALERGIAS */}
          <div className="form-grid">
            <section className="card">
              <h2>Alimentação (&ldquo;Almocinho&rdquo;)</h2>
              <ul className="roster-list">
                <li className="roster-row">
                  <span className="muted">Ração / Dieta</span>
                  <strong>{p?.feedingFood ?? 'Não informada'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Quantidade por porção</span>
                  <strong className="wb-mono">
                    {p?.feedingPortionGrams != null ? `${p.feedingPortionGrams} g` : '—'}
                  </strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Horários na creche</span>
                  <strong className="wb-mono">
                    {p?.feedingTimes && p.feedingTimes.length > 0
                      ? p.feedingTimes.join(' · ')
                      : '—'}
                  </strong>
                </li>
              </ul>
            </section>

            <section className="card">
              <h2>Medicação, Alergias &amp; Preventivos</h2>
              <ul className="roster-list">
                <li className="roster-row">
                  <span className="muted">Medicação em uso</span>
                  <strong>{p?.medicationName ?? 'Nenhuma medicação em uso'}</strong>
                </li>
                {p?.medicationName ? (
                  <>
                    <li className="roster-row">
                      <span className="muted">Dosagem</span>
                      <strong>{p.medicationDosage ?? '—'}</strong>
                    </li>
                    <li className="roster-row">
                      <span className="muted">Horário / Agenda</span>
                      <span>
                        <strong>{p.medicationSchedule ?? '—'}</strong>
                        {alerts?.hasDaycareMedication ? (
                          <span className="badge warn">Horário de creche</span>
                        ) : null}
                      </span>
                    </li>
                  </>
                ) : null}
                <li className="roster-row">
                  <span className="muted">Alergias</span>
                  <strong>{p?.allergies ?? 'Nenhuma registrada'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Vermífugo</span>
                  <span>
                    <span className={`badge${p?.dewormingUpToDate ? '' : ' warn'}`}>
                      {p?.dewormingUpToDate ? 'Em dia' : 'Pendente'}
                    </span>{' '}
                    <span className="muted wb-mono">
                      ({formatDateBr(p?.dewormingLastDate)})
                    </span>
                  </span>
                </li>
                <li className="roster-row">
                  <span className="muted">Antipulgas / Carrapatos</span>
                  <span>
                    <span className={`badge${p?.fleaControlUpToDate ? '' : ' warn'}`}>
                      {p?.fleaControlUpToDate ? 'Em dia' : 'Pendente'}
                    </span>{' '}
                    <span className="muted wb-mono">
                      ({formatDateBr(p?.fleaControlLastDate)})
                    </span>
                  </span>
                </li>
              </ul>
            </section>
          </div>

          {/* 3. BLOCOS DE COMPORTAMENTO/RESTRIÇÕES E EMERGÊNCIA VETERINÁRIA */}
          <div className="form-grid">
            <section className="card">
              <h2>Comportamento, Socialização &amp; Restrições</h2>
              <ul className="roster-list">
                <li className="roster-row">
                  <span className="muted">Avaliação comportamental</span>
                  <strong>{p?.behaviorNotes ?? 'Não registrada'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Restrições e cuidados de portão/guia</span>
                  <strong>{p?.restrictions ?? 'Nenhuma restrição especial'}</strong>
                </li>
              </ul>
            </section>

            <section className="card">
              <h2>Veterinário &amp; Contato de Emergência</h2>
              <ul className="roster-list">
                <li className="roster-row">
                  <span className="muted">Veterinário(a)</span>
                  <strong>{p?.vetName ?? '—'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Clínica</span>
                  <strong>{p?.vetClinic ?? '—'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Contato de emergência</span>
                  <strong>{p?.emergencyContactName ?? '—'}</strong>
                </li>
                <li className="roster-row">
                  <span className="muted">Telefone de emergência</span>
                  <strong className="wb-mono">{p?.emergencyContactPhone ?? '—'}</strong>
                </li>
              </ul>
            </section>
          </div>
        </>
      )}
    </main>
  );
}

export default function FichaDoPetPage() {
  return (
    <RequireAuth area="escola">
      <FichaDoPetView />
    </RequireAuth>
  );
}
