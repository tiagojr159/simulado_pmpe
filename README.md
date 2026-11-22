# Rumo à Farda — Simulado PMPE

Aplicação web responsiva para praticar questões e registrar resultados em um ranking por data.

## Requisitos

- PHP 8.1+ (a API usa recursos padrão do PHP; `mbstring` é recomendado)
- Apache com `mod_rewrite` não é necessário
- Conexão com a internet para carregar a lista oficial de estados e municípios do IBGE e as fontes tipográficas

## Como abrir no XAMPP

1. Coloque a pasta em `C:\xampp\htdocs\simulado_pmpe`.
2. Inicie o Apache no XAMPP Control Panel.
3. Acesse `http://localhost/simulado_pmpe/`.

O formulário abre com Pernambuco selecionado. Ao escolher outro estado, a lista de municípios é atualizada.

## Arquivos de dados

- `data/questions.json`: prova completa do Caderno 01 extraída dos PDFs fornecidos, com gabarito definitivo, IDs de questão, matérias, textos-base compartilhados e figuras. Os textos 1, 2 e 3 estão relacionados às questões 1–6, 9–13 e 14–15. Cada questão aponta para o texto pelo passageId; o texto é reapresentado antes de toda questão associada, e o gabarito não é enviado ao navegador. As questões 19, 26, 36 e 58 foram anuladas no gabarito definitivo e recebem ponto automático.
- `data/ranking.json`: resultados salvos, ordenados do mais recente para o mais antigo.

O Apache bloqueia o acesso direto à pasta `data/` por meio do `.htaccess`. A conta do serviço Apache precisa ter permissão de escrita em `data/ranking.json` para registrar os resultados.

O simulado de 10 questões seleciona duas de cada matéria; o de 30 seleciona uma amostra equilibrada (8 de Português, 5 de Matemática, 5 de Geografia, 5 de História e 7 de Direitos e Garantias Fundamentais); o de 60 usa o caderno completo. O site é independente e não substitui informações oficiais do concurso.

O resultado é calculado como percentual de acertos: mais de 80 pontos = aprovado; de 60 a 80, inclusive = fila de remanejamento; menos de 60 = reprovado.
