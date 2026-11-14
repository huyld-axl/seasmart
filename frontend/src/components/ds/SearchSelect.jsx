import { forwardRef } from 'react'
import { Select } from 'antd'
import { filterSearchOption } from '../../utils/search'

// Giữ filterOption=false cho các danh sách tìm qua API.
const SearchSelect = forwardRef(function SearchSelect({ showSearch, filterOption, optionFilterProp, ...props }, ref) {
  const config = typeof showSearch === 'object' && showSearch ? showSearch : {}
  const customFilter = config.filterOption ?? filterOption
  const field = config.optionFilterProp ?? optionFilterProp ?? 'label'
  const filter = customFilter === undefined || customFilter === true
    ? (input, option) => filterSearchOption(input, option, field)
    : customFilter

  return (
    <Select
      {...props}
      ref={ref}
      showSearch={typeof showSearch === 'object' && showSearch ? { ...showSearch, filterOption: filter } : showSearch}
      optionFilterProp={optionFilterProp}
      filterOption={filter}
    />
  )
})

export default SearchSelect
