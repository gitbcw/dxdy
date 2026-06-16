'use client'

import * as React from 'react'
import { areaList } from '@vant/area-data'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
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
  .filter(([, name]) => Boolean(name) && !name.includes('市辖区') && name !== '省直辖县')
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
 * 城市多选搜索框：自定义下拉多选，选项来自国标行政区划。
 * 已选城市在输入框下方以 Badge 展示，可单独移除。
 */
export function CityMultiSelect({
  value,
  onChange,
  placeholder = '搜索城市，如：广州',
}: CityMultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const keyword = query.trim()
    if (!keyword) return ALL_CITIES
    return ALL_CITIES.filter(
      (city) => city.value.includes(keyword) || city.province.includes(keyword),
    )
  }, [query])

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  function toggleCity(city: string) {
    onChange(value.includes(city) ? value.filter((item) => item !== city) : [...value, city])
  }

  function removeCity(city: string) {
    onChange(value.filter((item) => item !== city))
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={value.length ? 'text-foreground' : 'text-muted-foreground'}>
          {value.length ? `已选 ${value.length} 个城市` : placeholder}
        </span>
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索城市"
            className="mb-2 h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            onClick={(event) => event.stopPropagation()}
          />
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                未找到匹配城市
              </div>
            ) : (
              filtered.map((city) => {
                const selected = value.includes(city.value)
                return (
                  <div
                    key={city.value}
                    role="option"
                    aria-selected={selected}
                    onClick={() => toggleCity(city.value)}
                    className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <span>{city.value}</span>
                      <span className="text-xs text-muted-foreground">{city.province}</span>
                    </span>
                    {selected && <CheckIcon className="size-4" />}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {value.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
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
