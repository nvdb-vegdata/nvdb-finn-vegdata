# NVDB Finn Vegdata

Proof of concept for visualisering av vegobjekter fra NVDB ved hjelp av [Uberiket API](https://nvdb.atlas.vegvesen.no/docs/category/uberiket).

**Demo:** https://nvdb-vegdata.github.io/nvdb-vis-vegobjekter/

## Funksjonalitet

- Søk og velg vegobjekttyper fra Datakatalogen
- Tegn polygon på kartet for å avgrense område
- Henter veglenker og vegobjekter innenfor valgt område
- Klikk på veglenke for å se tilknyttede vegobjekter
- Detaljvisning av egenskaper, stedfesting og relasjoner
- URL-synkronisering av kartvisning, polygon og valgte typer

## Kjøring lokalt

```bash
bun install
bun run dev
```

Åpne http://localhost:3000

## Teknologi

- Bun
- React + TypeScript
- OpenLayers
- TanStack Query




## GitHub

The repo is maintained in SVV Bitbucket, but mirrored as a public repository to GitHub, as a reference project. This mirroring has to be done manually.

Add GitHub as a remote:
```bash
git remote set-url github https://github.com/nvdb-vegdata/nvdb-finn-vegdata.git
```

Push the main branch to GitHub:
```bash 
git push github main
```