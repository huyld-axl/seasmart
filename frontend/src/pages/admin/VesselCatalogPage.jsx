import VesselMasterDataPage from './master-data/VesselMasterDataPage'
import useTranslation from '../../hooks/useTranslation'

export default function VesselCatalogPage() {
  const { t } = useTranslation()
  return (
    <div>
      <h2 style={{ marginBottom: 16, fontWeight: 600 }}>{t('menu.vesselCatalog')}</h2>
      <VesselMasterDataPage />
    </div>
  )
}
