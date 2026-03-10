import { useAtom } from 'jotai'
import { ChevronDown, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getKategorier, getVegobjekttyper, isSelectableVegobjekttype, type Kategori, type Vegobjekttype } from '../../api/datakatalogClient'
import { allTypesSelectedAtom, selectedTypesAtom, VEGLENKESEKVENSER_LIMIT_OPTIONS, veglenkesekvensLimitAtom } from '../../state/atoms'

export default function ObjectTypeSelector() {
  const [veglenkesekvensLimit, setVeglenkesekvensLimit] = useAtom(veglenkesekvensLimitAtom)
  const [selectedTypes, setSelectedTypes] = useAtom(selectedTypesAtom)
  const [allTypesSelected, setAllTypesSelected] = useAtom(allTypesSelectedAtom)
  const [allTypes, setAllTypes] = useState<Vegobjekttype[]>([])
  const [categories, setCategories] = useState<Kategori[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadTypes() {
      try {
        setIsLoading(true)
        const [types, kategoriList] = await Promise.all([getVegobjekttyper(), getKategorier()])
        const visibleTypes = types.filter(isSelectableVegobjekttype).sort((a, b) => (a.navn ?? '').localeCompare(b.navn ?? ''))
        const getCategoryDisplayName = (kategori: Kategori) => kategori.navn ?? kategori.kortnavn ?? `Kategori ${kategori.id}`
        const sortedCategories = [...kategoriList].sort((a, b) => {
          return getCategoryDisplayName(a).localeCompare(getCategoryDisplayName(b), 'nb', { sensitivity: 'base' })
        })
        setAllTypes(visibleTypes)
        setCategories(sortedCategories)
      } catch (err) {
        setError('Kunne ikke laste vegobjekttyper eller kategorier')
        console.error(err)
      } finally {
        setIsLoading(false)
      }
    }
    loadTypes()
  }, [])

  useEffect(() => {
    if (!allTypesSelected || allTypes.length === 0) return
    setSelectedTypes(allTypes)
  }, [allTypes, allTypesSelected, setSelectedTypes])

  const filteredTypes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return allTypes
    return allTypes.filter(
      (type) => type.navn?.toLowerCase().includes(query) || type.id.toString().includes(query) || type.beskrivelse?.toLowerCase().includes(query),
    )
  }, [allTypes, searchQuery])

  const ALL_CATEGORY_ID = 38

  const isSelected = (type: Vegobjekttype) => selectedTypes.some((t) => t.id === type.id)

  const handleTypeToggle = (type: Vegobjekttype) => {
    if (allTypesSelected) return
    setSelectedCategoryId('')
    setAllTypesSelected(false)
    setSelectedTypes((prev) => {
      const exists = prev.some((t) => t.id === type.id)
      if (exists) {
        return prev.filter((t) => t.id !== type.id)
      }
      return [...prev, type]
    })
  }

  const handleCategorySelect = (value: string) => {
    if (!value) {
      setSelectedCategoryId('')
      setAllTypesSelected(false)
      return
    }

    const categoryId = Number(value)
    if (!Number.isFinite(categoryId)) {
      setSelectedCategoryId('')
      setAllTypesSelected(false)
      return
    }

    setSelectedCategoryId(value)

    if (categoryId === ALL_CATEGORY_ID) {
      setAllTypesSelected(true)
      setSelectedTypes(allTypes)
      return
    }

    setAllTypesSelected(false)

    const categoryTypes = allTypes.filter((type) => type.kategorier.some((kategori) => kategori.id === categoryId))

    setSelectedTypes(categoryTypes)
  }

  const handleTypeRemove = (typeId: number) => {
    if (allTypesSelected) return
    setSelectedCategoryId('')
    setAllTypesSelected(false)
    setSelectedTypes((prev) => prev.filter((type) => type.id !== typeId))
  }

  const handleClearTypes = () => {
    setSelectedCategoryId('')
    setAllTypesSelected(false)
    setSelectedTypes([])
  }

  if (isLoading) {
    return <div className="loading">Laster vegobjekttyper...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  return (
    <div>
      <div className="section-header-row">
        <div className="section-header">Vegobjekttyper</div>
        <div className="limit-inline">
          <label htmlFor="veglenke-limit">Maks veglenkesekvenser</label>
          <select id="veglenke-limit" className="limit-select" value={veglenkesekvensLimit} onChange={(e) => setVeglenkesekvensLimit(Number(e.target.value))}>
            {VEGLENKESEKVENSER_LIMIT_OPTIONS.map((limitOption) => (
              <option key={limitOption} value={limitOption}>
                {limitOption}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="search-row">
        <label className="search-label" htmlFor="type-search">
          Søk på navn eller ID
        </label>
        <div className="search-input-wrapper">
          <input
            id="type-search"
            type="text"
            className="search-input"
            placeholder="fartsgrense, 105"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Tøm søk">
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="category-row">
        <label className="search-label" htmlFor="category-select">
          Velg kategori
        </label>
        <div className="category-select-wrapper">
          <select id="category-select" className="category-select" value={selectedCategoryId} onChange={(e) => handleCategorySelect(e.target.value)}>
            <option value="">Velg kategori</option>
            {categories.map((kategori) => (
              <option key={kategori.id} value={kategori.id}>
                {`${kategori.navn ?? kategori.kortnavn ?? `Kategori ${kategori.id}`} (#${kategori.id})`}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="category-select-icon" aria-hidden="true" />
        </div>
      </div>

      {selectedTypes.length > 0 && (
        <>
          <div className="selected-summary">
            <div className="selected-count">{allTypesSelected ? 'Alle valgt' : `${selectedTypes.length} valgt`}</div>
            <button type="button" className="clear-types-btn" onClick={handleClearTypes}>
              Fjern alle
            </button>
          </div>
          <div className="selected-chips">
            {allTypesSelected ? (
              <button type="button" className="selected-chip" onClick={handleClearTypes} aria-label="Fjern alle">
                <span className="selected-chip-label">Alle</span>
                <X size={12} className="selected-chip-remove" aria-hidden="true" />
              </button>
            ) : (
              selectedTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className="selected-chip"
                  onClick={() => handleTypeRemove(type.id)}
                  aria-label={`Fjern ${type.navn ?? `type ${type.id}`}`}
                >
                  <span className="selected-chip-label">{type.navn ?? `Type ${type.id}`}</span>
                  <span className="selected-chip-id">#{type.id}</span>
                  <X size={12} className="selected-chip-remove" aria-hidden="true" />
                </button>
              ))
            )}
          </div>
        </>
      )}

      <ul className="object-type-list">
        {filteredTypes.map((type) => (
          <li
            key={type.id}
            className={`object-type-item ${isSelected(type) ? 'selected' : ''}`}
            onClick={() => {
              if (!allTypesSelected) {
                handleTypeToggle(type)
              }
            }}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !allTypesSelected) {
                e.preventDefault()
                handleTypeToggle(type)
              }
            }}
            aria-disabled={allTypesSelected}
          >
            <input type="checkbox" className="object-type-checkbox" checked={isSelected(type)} disabled={allTypesSelected} onChange={() => {}} />
            <div className="object-type-info">
              <div className="object-type-header">
                <div className="object-type-name">{type.navn}</div>
                <div className="object-type-id">ID: {type.id}</div>
              </div>
              {type.beskrivelse && (
                <div className="object-type-description" title={type.beskrivelse}>
                  {type.beskrivelse}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
