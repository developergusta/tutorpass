import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AuthService } from './auth.service';

// Fluxo "esqueci minha senha" (varredura 17/11/2026: não existia NENHUM
// caminho de recuperação — admin que esquecesse a senha perdia a conta).
//
// Token de uso único, 1 h de validade, guardado como hash SHA-256.
// Entrega v1: ainda não há provedor de e-mail, então o link fica
// disponível p/ os ADMINs da escola do usuário (GET /auth/password-resets)
// passarem pessoalmente — numa escola, o admin conhece a equipe. O token
// cru vive SÓ em memória (nunca em banco, log ou disco) e some no uso,
// na expiração ou num pedido novo. Quando o e-mail transacional entrar,
// só a entrega muda; token e telas ficam.

const TTL_MS = 60 * 60 * 1000;

interface ResetRecord {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PendingReset {
  email: string;
  name: string;
  token: string;
  expiresAt: Date;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class PasswordResetService {
  private records: ResetRecord[] = [];
  private rawTokens = new Map<string, string>(); // tokenHash -> token cru (só memória)

  constructor(private readonly auth: AuthService) {}

  /**
   * Registra o pedido. Retorna false (sem efeito) p/ e-mail desconhecido
   * ou conta inativa — o controller responde { ok: true } nos dois casos,
   * p/ não vazar quais e-mails têm conta.
   */
  request(email: string, now: Date = new Date()): boolean {
    const user = this.auth.findUserByEmail(email);
    if (!user || !user.isActive) return false;
    // Um token ativo por usuário: pedido novo invalida o anterior.
    for (const rec of this.records) {
      if (rec.userId === user.id && !rec.usedAt) {
        rec.usedAt = now;
        this.rawTokens.delete(rec.tokenHash);
      }
    }
    const token = randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    this.records.push({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(now.getTime() + TTL_MS),
      usedAt: null,
    });
    this.rawTokens.set(tokenHash, token);
    return true;
  }

  /** Consome o token e troca a senha (o AuthService revoga as sessões). */
  reset(token: string, newPassword: string, now: Date = new Date()): void {
    const tokenHash = hashToken((token ?? '').trim());
    const rec = this.records.find((r) => r.tokenHash === tokenHash);
    if (!rec || rec.usedAt || rec.expiresAt.getTime() < now.getTime()) {
      throw new BadRequestException(
        'Link inválido ou expirado — peça um novo em "Esqueci minha senha".',
      );
    }
    this.auth.resetPasswordWithToken(rec.userId, newPassword);
    rec.usedAt = now;
    this.rawTokens.delete(tokenHash);
  }

  /** Pedidos pendentes dos usuários da escola — a entrega v1 (admin). */
  listPendingForSchool(schoolId: string, now: Date = new Date()): PendingReset[] {
    const out: PendingReset[] = [];
    for (const rec of this.records) {
      if (rec.usedAt || rec.expiresAt.getTime() < now.getTime()) continue;
      const isMember = this.auth
        .listMemberships(rec.userId)
        .some((m) => m.schoolId === schoolId);
      if (!isMember) continue;
      const token = this.rawTokens.get(rec.tokenHash);
      if (!token) continue;
      const pub = this.auth.getPublicUser(rec.userId);
      out.push({ email: pub.email, name: pub.name, token, expiresAt: rec.expiresAt });
    }
    return out;
  }
}
