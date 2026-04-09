import { findPosisjon, type PosisjonMedAvstand } from './generated/vegnett'

export async function hentVegnettPosisjon(nord: number, ost: number): Promise<PosisjonMedAvstand[]> {
  return findPosisjon({
    query: {
      nord: nord,
      ost: ost,
      detaljerte_lenker: true,
      konnekteringslenker: true,
    },
  }).then((response) => {
    if (response.data) {
      return response.data
    } else {
      throw new Error('Ingen data mottatt fra API-et. Klikk i kartet en gang til!')
    }
  })
}
