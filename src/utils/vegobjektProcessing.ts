import type { Egenskapstype, Vegobjekttype } from '../api/datakatalogClient'
import { getEgenskapstypeById, getEnumVerdiById, getVegobjekttypeById } from '../api/datakatalogClient'
import type { EgenskapVerdi, EnumEgenskap, Stedfesting, Vegobjekt } from '../api/uberiketClient'
import { formatStedfesting, getEgenskapDisplayValue } from '../api/uberiketClient'

export interface VegobjektDetails {
  id: number
  typeId: number
  versjonId?: number
  sistEndret?: string
  gyldighetsperiode?: { startdato: string; sluttdato?: string }
  stedfestinger: string[]
  barn: { typeId: string; ids: number[] }[]
  egenskaper: { id: string; name: string; value: string }[]
}

export function getEgenskapValue(egenskap: EgenskapVerdi, egenskapstype: Egenskapstype | undefined): string {
  if (egenskap.type === 'EnumEgenskap' && egenskapstype) {
    const enumVerdi = getEnumVerdiById(egenskapstype, (egenskap as EnumEgenskap).verdi)
    if (enumVerdi) {
      return enumVerdi.verdi != null ? String(enumVerdi.verdi) : (enumVerdi.kortnavn ?? `ID: ${enumVerdi.id}`)
    }
  }
  return getEgenskapDisplayValue(egenskap)
}

export function processVegobjekt(obj: Vegobjekt, typeId: number, vegobjekttype: Vegobjekttype | undefined): VegobjektDetails {
  const egenskaper: VegobjektDetails['egenskaper'] = []
  if (obj.egenskaper) {
    for (const [id, egenskap] of Object.entries(obj.egenskaper)) {
      const egenskapstype = vegobjekttype ? getEgenskapstypeById(vegobjekttype, Number(id)) : undefined
      const name = egenskapstype?.navn ?? `Egenskap ${id}`
      const value = getEgenskapValue(egenskap, egenskapstype)
      egenskaper.push({ id, name, value })
    }
  }

  const barn: VegobjektDetails['barn'] = []
  if (obj.barn) {
    for (const [typeIdStr, ids] of Object.entries(obj.barn)) {
      barn.push({
        typeId: typeIdStr,
        ids: Array.isArray(ids) ? ids : Array.from(ids as Set<number>),
      })
    }
  }

  return {
    id: obj.id,
    typeId,
    versjonId: obj.versjon,
    sistEndret: obj.sistEndret,
    gyldighetsperiode: obj.gyldighetsperiode,
    stedfestinger: formatStedfesting(obj.stedfesting as Stedfesting | undefined),
    barn,
    egenskaper,
  }
}

export function getVegobjekttypeForType(typeId: number): Vegobjekttype | undefined {
  return getVegobjekttypeById(typeId)
}
