# Melhoria contínua (agente horário)

A cada execução, o agente deve:
1. Ler `BACKLOG.md`, `README.md` e o git status/log (se houver repo) e escolher **UMA** melhoria pequena, completa e verificável — nunca deixar o projeto quebrado no meio.
2. Priorizar nesta ordem: bug/correção > teste/verificação > feature do Step 2 > refinamento de layout/design (web/mobile) > documentação.
3. Implementar, rodar a verificação disponível (build/typecheck/teste/lint; se não houver, validar sintaxe dos arquivos alterados) e registrar o que fez em `CHANGELOG-DEV.md` (data, item, arquivos, verificação).
4. Atualizar o `BACKLOG.md` marcando o item concluído e, se descobrir bug, adicioná-lo no topo.
5. Limites: trabalhar **só dentro de `~/workspace/tutorpass`**; não publicar/deployar, não enviar mensagens/e-mails, não comprar nada, não apagar dados, não trocar segredos/.env. Sem git remoto configurado, não tentar push.
6. Se nada puder ser verificado com segurança, fazer só a melhoria documental/de layout de menor risco e registrar o porquê.
