'use client'

import * as React from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { areaList } from '@vant/area-data'
import { CheckIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// 国标行政区划数据预处理（模块级只计算一次）
// areaList.city_list 的 key 为 6 位行政代码，前 2 位对应省级代码
const provinceByPrefix: Record<string, string> = Object.fromEntries(
  Object.entries(areaList.province_list).map(([code, name]) => [code.slice(0, 2), name]),
)

interface CityOption {
  value: string
  province: string
}

const ALL_CITIES: CityOption[] = Object.entries(areaList.city_list)
  .filter(([, name]) => Boolean(name) && !name.includes('市辖区'))
  .map(([code, name]) => ({ value: name, province: provinceByPrefix[code.slice(0, 2)] || '' }))
  .sort(
    (a, b) =>
      a.province.localeCompare(b.province, 'zh') || a.value.localeCompare(b.value, 'zh'),
  )

export interface CityMultiSelectProps {
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

/**
 * 城市多选搜索框：基于 Base UI Combobox（多选），
 * 选项来自国标行政区划（与小程序收货地址的微信 region picker 同源）。
 * 已选城市在输入框下方以 Badge 展示，可单独移除。
 */
export function CityMultiSelect({
  value,
  onChange,
  placeholder = '搜索城市，如：广州',
}: CityMultiSelectProps) {
  const [query, setQuery] = React.useState('')

  const filtered = React.useMemo(() => {
    const keyword = query.trim()
    if (!keyword) return ALL_CITIES
    return ALL_CITIES.filter(
      (city) => city.value.includes(keyword) || city.province.includes(keyword),
    )
  }, [query])

  function removeCity(city: string) {
    onChange(value.filter((item) => item !== city))
  }

  return (
    <div className="space-y-2">
      <Combobox.Root<string, true>
        multiple
        value={value}
        onValueChange={onChange}
        onInputValueChange={(inputValue) => setQuery(inputValue)}
      >
        <Combobox.Input
          placeholder={placeholder}
          className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Combobox.Positioner>
          <Combobox.Popup className="z-50 max-h-72 w-(--anchor-width) min-w-56 overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            <Combobox.List>
              {filtered.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  未找到匹配城市
                </div>
              ) : (
                filtered.map((city) => (
                  <Combobox.Item
                    key={city.value}
                    value={city.value}
                    className="relative flex w-full cursor-default items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                  >
                    <span className="flex flex-1 items-center gap-2">
                      <span>{city.value}</span>
                      <span className="text-xs text-muted-foreground">{city.province}</span>
                    </span>
                    <Combobox.ItemIndicator className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                      <CheckIcon className="size-4" />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                ))
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Root>

      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((city) => (
            <Badge key={city} variant="secondary" className="gap-1 pr-1">
              {city}
              <button
                type="button"
                onClick={() => removeCity(city)}
                aria-label={`移除 ${city}`}
                className="rounded-sm opacity-60 transition-opacity hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
