import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  // Fila serial de escrita (write-through) dos serviços que ainda guardam o
  // estado em memória (AuthService, RosterService): cada mutação enfileira a
  // operação equivalente no Prisma e a fila executa em ordem, sem bloquear a
  // resposta (os métodos dos serviços são síncronos). Uma falha é registrada
  // e NÃO derruba a fila nem o pedido — a memória segue como fonte da sessão
  // atual e o erro aparece no log p/ investigação. `flushWrites` é chamado no
  // desligamento (onModuleDestroy dos serviços) e nos testes.
  private writeChain: Promise<unknown> = Promise.resolve();

  enqueueWrite(op: () => Promise<unknown>): void {
    this.writeChain = this.writeChain.then(op).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[PrismaService] falha no write-through:', err);
    });
  }

  async flushWrites(): Promise<void> {
    await this.writeChain;
  }
}
