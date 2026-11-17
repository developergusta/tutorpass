# Cadastro (roster): escolas, turmas, alunos, tutores + importação CSV

A peça que prova a tese **"implantação em 1 dia"**: a secretaria sobe o
cadastro inteiro com uma planilha, confere a prévia e salva — sem redigitar
aluno por aluno.

Inspiração (pesquisa frente a, ciclo 17): PickupRoster — CSV/XLSX com guias
por SIS (PowerSchool, Infinite Campus, Skyward, Blackbaud) e re-importação
que atualiza o aluno existente; "pickup." — prévia de matches e duplicatas
antes de salvar; DismissPro — template CSV p/ download + export do cadastro
atual ("Download Master Roster"); QManager — setup em 24 h com importação
de planilha ou sync com o SIS.

## O que o `RosterService` faz

### Escolas
- `createSchool` — nome + slug (gerado do nome quando omitido; o slug é o
  subdomínio e **nunca muda** depois de criado) + CNPJ opcional + fuso
  (default `America/Sao_Paulo`).
- `updateSchool` (nome/CNPJ/fuso), `deactivateSchool`/`reactivateSchool`
  (escola desativada bloqueia novos cadastros), `listSchools`.

### Turmas
- `createClassroom` — nome único por escola + ano letivo (comparação sem
  acento/maiúscula: "3º A" = "3º a"), `renameClassroom`,
  `deactivateClassroom` (turma desativada não recebe novos alunos),
  `listClassrooms` (filtro por ano letivo).

### Alunos
- `createStudent` — nome, turma, matrícula opcional (única por escola) e
  nascimento (`DD/MM/AAAA` ou `AAAA-MM-DD`, nunca no futuro).
- `updateStudent`, `transferStudent` (troca de turma na mesma escola),
  `setStudentStatus` (`ACTIVE`/`INACTIVE`/`TRANSFERRED` — aluno nunca é
  apagado, só muda de status).
- `blockPickup`/`unblockPickup` — bloqueio de retirada (judicial/
  administrativo) com motivo obrigatório.
- `listStudents` — por turma, status e busca por nome (sem acento/maiúscula).

### Tutores e vínculos
- `createTutor` — nome + telefone (normalizado p/ só dígitos, DDD incluído,
  único por escola) + documento opcional.
- `blockTutor`/`unblockTutor` — tutor bloqueado não pode ser vinculado.
- `linkTutor` — vínculo com parentesco (`FATHER`/`MOTHER`/`GRANDPARENT`/
  `SIBLING`/`GUARDIAN`/`OTHER`), `isPrimary` e `canPickup`; **só um
  primário por aluno** — o novo derruba o anterior. `unlinkTutor`,
  `listTutorsOfStudent`, `listStudentsOfTutor`.

### Limite do plano
- `setStudentLimit(schoolId, max)` — alimentado no Step 2 pelo
  `PlanService.canAddStudent` (FREE: 30 alunos); sem limite configurado,
  não há teto. A criação e a importação respeitam o teto.

## Importação CSV (`importStudents`)

```
nome;turma;matricula;nascimento;responsavel;telefone;parentesco
Ana Silva;3º A;2026001;12/03/2018;Maria Silva;(11) 98765-4321;mãe
```

- Delimitador detectado sozinho (`;` ou `,`); campos entre aspas suportados.
- Cabeçalho em pt-BR ou inglês (`nome`/`name`, `turma`/`classroom`,
  `matricula`, `nascimento`, `responsavel`, `telefone`, `parentesco`).
- **Re-importar atualiza, nunca apaga**: por matrícula, atualiza nome,
  nascimento e turma; sem matrícula, duplicata por nome + turma é pulada e
  relatada. É o oposto do "Upload and Override" do DismissPro, que substitui
  o cadastro inteiro — aqui nada some sem rastro.
- Turma inexistente é **criada** (ano letivo do `options.academicYear`, ou o
  corrente); com `createClassrooms: false`, vira erro na linha.
- Colunas de responsável criam o tutor (por telefone) e o vínculo — o
  primeiro tutor do aluno vira o primário.
- **Cada linha ruim vira um erro com o nº da linha** e o resto do arquivo
  segue (`ImportReport.errors`); nada aborta a importação inteira.
- **`dryRun: true`** valida tudo e relata sem gravar — a prévia de
  matches/duplicatas do PickupRoster/"pickup.": a secretaria confere antes
  de salvar.
- `rosterTemplateCsv()` — template p/ download (cabeçalho + 2 exemplos).
- `exportRosterCsv(schoolId)` — export do cadastro atual, no mesmo formato
  (backup antes de re-importar; o export re-importado atualiza, não duplica).

## O que NÃO faz (Step 2)
- Controller REST `/roster/*` com guards (`ADMIN`/`COORDINATOR` p/ escrever,
  `TEACHER` p/ ler a própria turma) e upload de arquivo (multipart).
- Persistência via Prisma (`School`/`Classroom`/`Student`/`Tutor`/
  `TutorStudent`, já no schema) + `SchoolMember` p/ staff.
- Vincular `Tutor.userId` ao `AuthService` (login do tutor por SMS, fase 2)
  e foto do aluno com consentimento `STUDENT_PHOTO`.
- Sync com SIS (PowerSchool/Blackbaud via GG4L) — o CSV cobre o 1º dia; o
  sync é fase 2.
