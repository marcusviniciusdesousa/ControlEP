@echo off
chcp 65001 >nul
cd /d "%~dp0"
set BRANCH=fix/auditoria-e-melhorias
rem Este script e o log nao entram no repositorio
findstr /x /c:"commit-e-push.bat" .git\info\exclude >nul 2>&1 || echo commit-e-push.bat>> .git\info\exclude
findstr /x /c:"git-push-log.txt" .git\info\exclude >nul 2>&1 || echo git-push-log.txt>> .git\info\exclude
(
  echo == Branch atual ==
  git branch --show-current
  echo == Criando/usando o branch %BRANCH% ==
  git switch -c %BRANCH% 2^>nul ^|^| git switch %BRANCH%
  echo == Arquivos alterados ==
  git add -A
  git status --short
  echo == Commit ==
  git commit -m "fix: auditoria completa e melhorias do ControlEP" -m "- Sessao com refresh token rotativo (corrige desconexoes)" -m "- Aprovacao de usuarios (Pendente/Aprovado/Rejeitado) e Master unico" -m "- Turnos: edicao, unicidade de nome/horario e dias da semana" -m "- Funcionarios: data de admissao e ativacao/desativacao" -m "- Equipamentos: emprestimos persistidos, status e exclusao logica" -m "- Presenca: regras de admissao/escala e status Dispensa baixa volumetria" -m "- Dashboard calculado no servidor; filtros persistentes; datas pt-BR" -m "- Interface responsiva; .env.example e migrations novas; testes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -m "Claude-Session: https://claude.ai/code/session_01CfECGYPd16kJZtkp9J17Kb"
  echo == Push ==
  git push -u origin %BRANCH%
  echo == Resultado ==
  git log --oneline -3
  git status --short --branch
) > git-push-log.txt 2>&1
type git-push-log.txt
echo.
echo Concluido. Pode fechar esta janela.
pause
