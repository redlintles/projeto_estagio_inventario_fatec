# Identidade visual — Patrimônio Fatec

A marca representa um documento de patrimônio com etiqueta de barras e um selo de conferência. Usa as cores do sistema: verde `#087C79`, azul escuro `#12323D` e branco `#FFFFFF`. Não reproduz a identidade institucional oficial da Fatec.

- `patrimonio-fatec.svg`: matriz escalável com fundo arredondado.
- `patrimonio-fatec.png`: prévia e ícone de 512 × 512 pixels.
- `../../web/public/patrimonio-fatec.svg`: favicon e marca no login e cabeçalho do dashboard.
- Android: foreground vetorial e fundo separados, máscaras adaptativas do launcher e silhueta para ícones temáticos no Android 13 ou superior. O manifesto usa a mesma marca no ícone normal e no redondo.

As formas e cores são definidas em `scripts/brand-icons.mjs`. Para regenerar os recursos, execute na raiz:

```sh
node scripts/brand-icons.mjs
inkscape assets/brand/patrimonio-fatec.svg --export-type=png --export-filename=assets/brand/patrimonio-fatec.png --export-width=512 --export-height=512
```

Os recursos são vetoriais nativos, sem fonte externa ou imagem gerada por IA. Ao mudar a marca, recompile o Android e atualize com `adb install -r`; o launcher pode manter o ícone anterior em cache até reiniciar sua interface. A atualização preserva os dados do app.
