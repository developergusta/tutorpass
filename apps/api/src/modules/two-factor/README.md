# 2FA TOTP p/ staff — `TwoFactorService`

Segundo fator p/ o login do staff (secretaria, portaria, coordenação,
professores). Tutores NÃO usam 2FA aqui — entram por código SMS, que já é o
2º fator (ver `docs/product/IDEAS.md`, ciclo 15).

## Fluxo

1. **Cadastro** — `POST /auth/2fa/setup` (logado) devolve a URL `otpauth://`
   (o cliente renderiza o QR) + o segredo em texto p/ digitação manual.
   `POST /auth/2fa/confirm` com um código do app autenticador ativa o 2FA e
   devolve os 10 códigos de recuperação **uma única vez**.
2. **Login** — a senha passa, mas o 2FA está ativo: o `POST /auth/login`
   devolve `{ requires2fa: true, twoFactorToken }` em vez da sessão.
   `POST /auth/2fa/verify` com o token do desafio + o código emite o access
   e o refresh (o refresh sai no mesmo cookie httpOnly do login).
3. **Desativar / regenerar** — exigem um código 2FA válido. ADMIN nunca
   desativa (política obrigatória); regenerar o lote invalida o anterior.

## Regras (RFC 6238 + NIST SP 800-63B-4)

- TOTP: HMAC-SHA1, 6 dígitos, janela de 30 s, verificação ±1 passo
  (tolerância a relógio dessincronizado). Implementado com `node:crypto`,
  sem dependência externa — e validado contra os vetores do RFC 6238
  Apêndice B e do RFC 4226 Apêndice D nos testes.
- **Anti-replay**: cada passo de 30 s vale uma única vez (`lastUsedStep`).
- **Códigos de recuperação**: "look-up secrets" (NIST §3.1.2) — 10 códigos
  de 8 dígitos, uso único, guardados só como hash scrypt com salt. O texto
  some após a exibição; quem perde a lista gera um lote novo.
- **Lockout**: 5 códigos errados travam o 2FA por 15 min (mesmo padrão do
  lockout de senha do `AuthService`).
- **Desafio de login**: token opaco de uso único, 5 min de validade, só o
  hash SHA-256 guardado (mesmo padrão do refresh token). Código errado não
  queima o desafio — só o código certo consome.
- **Política**: ADMIN sempre obrigado (sem como desligar, como a Realsmart);
  a escola pode ampliar p/ outros papéis (`setSchoolPolicy`), nunca afrouxar.
  Quem é obrigado mas ainda não cadastrou o 2FA faz login normalmente com a
  flag `twoFactorSetupRequired: true` (período de carência — o cliente leva
  p/ a tela de Segurança; o prazo de 14 dias e o bloqueio ficam p/ o Step 2).

## Auditoria

Toda mudança de 2FA (cadastro, ativação, desativação, verificação, falha,
bloqueio, desafio, regeneração) vai p/ `listAuditEvents()` — sem segredo nem
código no registro. No Step 2, ligar ao `AuditLog`/`SecurityIncidentService`
(reuso detectado = incidente, ver IDEAS.md, ciclo 15).

## Persistência (Step 2)

O serviço é in-memory, como os demais deste passo. O schema já tem o modelo
`TwoFactorEnrollment` (`userId` único, `secretEncrypted`, hashes dos códigos
de recuperação, `lastUsedStep`): ao persistir, **cifrar o segredo em repouso**
com chave do KMS — nunca guardar o segredo TOTP em claro no banco.
