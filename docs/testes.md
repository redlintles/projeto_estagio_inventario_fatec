# Testes e homologação

## Automatizados

Backend: regras de nota física e prazo estrito; hash de senha; CSV seguro; comparação de campos; PostgreSQL real com migrations; conflito de versão; confirmação explícita de localização; preservação da localização em divergências; reenvio simultâneo da mesma operação; suspensão de prazo por reserva; cancelamento e transporte; expiração e baixa; reimportação campo a campo; rollback em lote; autenticação e autorização HTTP; ocultação de hashes; paginação; foto idempotente; falha SMTP preservando a notificação para reenvio.

Web: envio de token/payload e propagação de erro de conflito. A compilação TypeScript verifica as telas. A verificação visual e os fluxos de usuário exigem também o roteiro abaixo.

Android: compilação do APK, testes da política de falhas de sincronização e lint. A câmera, armazenamento no aparelho e agendamento Android exigem teste em emulador/aparelho; testes JVM sozinhos não os comprovam.

## Banco de teste

`TEST_DATABASE_URL` deve apontar a um banco cujo nome contenha `test`. Os testes limpam tabelas; não use banco de desenvolvimento com dados que deseja manter. Sem a variável, a suíte de integração é ignorada explicitamente. CI inicia PostgreSQL descartável. Execute também migrations e restauração em uma cópia vazia quando alterar esquema.

## Roteiro operacional

1. Login como administrador; cadastrar sala, unidade e usuário patrimonial.
2. Importar modelo com um código que tenha zeros à esquerda; confirmar sua preservação.
3. Importar registro inválido e conferir erro por linha, sem inserção silenciosa.
4. Importar arquivo atualizado; manter um campo e aceitar outro; conferir histórico e localização.
5. Preparar inventário e atualizar base Android com rede.
6. Desligar rede; reiniciar app; ler etiqueta real e confirmar vários ativos.
7. Registrar divergência com foto; conferir que fila sobrevive ao reinício.
8. Reconectar; verificar uma única conferência por leitura e envio das fotos.
9. Alterar o mesmo ativo pelo portal antes da sincronização; verificar CONFLICT sem sobrescrita.
10. Expirar sessão; coletar dados localmente; refazer login com mesma conta e sincronizar.
11. Sair e entrar com outra conta; conferir que pendências não são enviadas como outro autor.
12. Disponibilizar com foto e nota; conferir e-mail no Mailpit e dados do ativo.
13. Reservar, executar monitoramento e verificar suspensão de baixa.
14. Cancelar e verificar reinício; reservar novamente, despachar e confirmar transferência.
15. Em outro ativo, simular prazo excedido no banco descartável; verificar B, e-mail e baixa com justificativa.
16. Entrar como Consulta e tentar alteração direta por API; deve receber 403.
17. Restaurar backup em ambiente separado e confirmar fotos/histórico.

## Checklist antes de entrega institucional

Homologar formato da planilha real e etiquetas; decidir domínio/rede e HTTPS; configurar SMTP real; testar em ao menos um aparelho representativo; validar capacidade da base; definir backup e responsável; assinar versão release. Essas decisões não são presumidas pela implementação.
